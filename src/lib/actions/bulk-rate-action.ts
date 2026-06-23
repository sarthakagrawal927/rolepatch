'use server';

import { generateObject } from 'ai';
import { z } from 'zod';

import { creditTokens, debitToken } from '@/lib/actions/token-actions';
import { getAIModel } from '@/lib/ai';
import { getCurrentUserId } from '@/lib/auth-utils';
import type { AIProviderConfig } from '@/lib/types';

const BATCH_SIZE = 20;
const DESC_CHAR_LIMIT = 1500;

export interface BulkRateJob {
  id: string;
  title: string;
  company: string;
  location?: string;
  description: string;
}

export interface BulkRateResult {
  score: number;
  rationale: string;
  strengths: string[];
  gaps: string[];
}

// Runtime schema (validates model output); passed to generateObject loosely to
// avoid TS inference explosion with ai v6 + zod 3.25. The result is validated
// again below for type safety.
const ratingItemSchema = z.object({
  id: z.string(),
  score: z.number().int().min(1).max(10),
  rationale: z.string(),
  strengths: z.array(z.string()).max(3),
  gaps: z.array(z.string()).max(3),
});

const ratingSchema = z.object({
  ratings: z.array(ratingItemSchema),
});

const SYSTEM_PROMPT =
  "You are a career coach scoring how well a candidate's resume matches a job description. Score 1-10 (10 = excellent fit, 1 = poor fit). Return strict JSON array.";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function formatBatch(jobs: BulkRateJob[]): string {
  return jobs
    .map((j, i) => {
      const loc = j.location ? ` — ${j.location}` : '';
      return `### Job ${i + 1} (id: ${j.id})\n**${j.title}** @ ${j.company}${loc}\n\n${truncate(j.description, DESC_CHAR_LIMIT)}`;
    })
    .join('\n\n---\n\n');
}

// Cast avoids a known ai v6 + zod 3.25 deep-instantiation error during TS
// build. Runtime validation still runs via ratingSchema.parse below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generateObjectLoose = generateObject as unknown as (
  args: any
) => Promise<{ object: unknown }>;

async function rateBatch(
  resumeSource: string,
  jobs: BulkRateJob[],
  aiConfig: AIProviderConfig
): Promise<Array<z.infer<typeof ratingItemSchema>>> {
  const { object } = await generateObjectLoose({
    model: getAIModel(aiConfig),
    schema: ratingSchema,
    system: SYSTEM_PROMPT,
    prompt: `## Resume:\n${resumeSource}\n\n## Jobs to rate (${jobs.length} total):\n${formatBatch(jobs)}\n\n## Instructions:\nReturn a JSON object { "ratings": [...] } with one entry per job matching on "id". score is 1-10. rationale is one sentence. strengths and gaps are each up to 3 short bullets (≤ 8 words). Base your judgment only on what the resume and description actually say.`,
  });
  const parsed = ratingSchema.parse(object);
  return parsed.ratings;
}

/**
 * Rates multiple jobs against a resume in batched AI calls.
 *
 * - Up to 20 jobs per call; splits into sequential calls if more.
 * - Debits ceil(jobs.length / 20) tokens up front; refunds all on failure.
 * - Auth-guarded: signed-out callers receive the ratings but nothing is persisted and no tokens are touched.
 */
const MAX_RESUME_CHARS = 20_000;
const MAX_JOBS = 100;

export async function rateJobsBulk(
  resumeSource: string,
  jobs: BulkRateJob[],
  aiConfig: AIProviderConfig
): Promise<Record<string, BulkRateResult>> {
  resumeSource = resumeSource.slice(0, MAX_RESUME_CHARS);
  jobs = jobs.slice(0, MAX_JOBS);
  if (jobs.length === 0) return {};

  const batches: BulkRateJob[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }
  const tokensNeeded = batches.length;

  const userId = await getCurrentUserId();
  let tokensDebited = 0;
  if (userId) {
    for (let i = 0; i < tokensNeeded; i++) {
      const result = await debitToken('fit_score', 'bulk_rate');
      if (!result.success) {
        if (tokensDebited > 0) {
          await creditTokens(userId, tokensDebited, 'refund', 'ai_failure');
        }
        throw new Error(
          result.error === 'insufficient_tokens'
            ? 'No tokens remaining. Purchase more to continue.'
            : 'Authentication required to generate.'
        );
      }
      tokensDebited += 1;
    }
  }

  try {
    const out: Record<string, BulkRateResult> = {};
    for (const batch of batches) {
      const ratings = await rateBatch(resumeSource, batch, aiConfig);
      for (const r of ratings) {
        out[r.id] = {
          score: r.score,
          rationale: r.rationale,
          strengths: r.strengths ?? [],
          gaps: r.gaps ?? [],
        };
      }
    }
    return out;
  } catch (err) {
    if (tokensDebited > 0 && userId) {
      await creditTokens(userId, tokensDebited, 'refund', 'ai_failure');
    }
    throw err;
  }
}
