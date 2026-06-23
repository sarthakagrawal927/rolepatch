'use server';

import { generateObject } from 'ai';
import { z } from 'zod';

// Cast avoids a known ai v6 + zod 3.25 deep-instantiation error during TS
// build. Runtime validation still runs via schema.parse at the call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generateObjectLoose = generateObject as unknown as (
  args: any
) => Promise<{ object: unknown }>;
import { v4 as uuid } from 'uuid';

import { creditTokens, debitToken } from '@/lib/actions/token-actions';
import { getAIModel } from '@/lib/ai';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { AIProviderConfig, SkillRoadmapItem, SkillsRoadmap } from '@/lib/types';

const roadmapSchema = z.object({
  items: z
    .array(
      z.object({
        skill: z
          .string()
          .describe('Concrete skill or capability name, e.g. "Kubernetes operators"'),
        priority: z.enum(['high', 'medium', 'low']),
        reason: z
          .string()
          .describe('One sentence — why this matters for the role, grounded in the JD'),
        resources: z
          .array(
            z.object({
              type: z.enum(['course', 'doc', 'project', 'book']),
              title: z.string(),
              url: z
                .string()
                .optional()
                .describe('Only include when you are certain the URL is real'),
              estimated_hours: z.number().int().positive().optional(),
            })
          )
          .min(1)
          .max(5),
        milestone: z
          .string()
          .describe('A concrete, verifiable deliverable proving the skill is acquired'),
      })
    )
    .min(1)
    .max(10),
  total_estimated_hours: z.number().int().nonnegative(),
  summary: z.string().describe('2-sentence overall plan'),
});

const SYSTEM_PROMPT = `You are a senior engineering mentor building a learning plan to close the gap between a candidate's resume and a target job description.

Rules:
- Every item must be grounded in the JD — no generic filler.
- Prioritize the skills with the largest gap and the highest JD weight.
- Recommend real, well-known resources (official docs, canonical courses, authoritative books, hands-on projects).
- Never fabricate URLs. If you are not certain a URL exists and is correct, omit the "url" field entirely.
- Each milestone must be a concrete, verifiable deliverable (build X, deploy Y, contribute to Z) — not "read about" or "understand".
- Keep the plan realistic: 3-8 items, actionable in weeks not years.`;

const MAX_RESUME_CHARS = 20_000;
const MAX_JD_CHARS = 15_000;

export async function generateSkillsRoadmap(
  resumeSource: string,
  jdText: string,
  jobId: string,
  aiConfig: AIProviderConfig
): Promise<SkillsRoadmap> {
  resumeSource = resumeSource.slice(0, MAX_RESUME_CHARS);
  jdText = jdText.slice(0, MAX_JD_CHARS);
  const userId = await getCurrentUserId();
  let debited = false;
  if (userId) {
    const result = await debitToken('interview_prep', 'skills_roadmap');
    if (!result.success) {
      throw new Error(
        result.error === 'insufficient_tokens'
          ? 'No tokens remaining. Purchase more to continue.'
          : 'Authentication required to generate.'
      );
    }
    debited = true;
  }

  try {
    const { object: rawObject } = await generateObjectLoose({
      model: getAIModel(aiConfig),
      schema: roadmapSchema,
      system: SYSTEM_PROMPT,
      prompt: `## Resume:\n${resumeSource}\n\n## Job Description:\n${jdText}\n\n## Instructions:\nIdentify the skill gaps most relevant to this role and produce a prioritized learning plan. For each gap: name the skill, priority (high/medium/low), one-sentence reason tied to the JD, 1-5 concrete resources (type + title; url only when you are certain), and a single verifiable milestone. Compute total_estimated_hours by summing the resources' estimated_hours you provided. Write a 2-sentence summary of the overall plan.`,
    });
    const object = roadmapSchema.parse(rawObject);

    const items: SkillRoadmapItem[] = object.items.map((i) => ({
      skill: i.skill,
      priority: i.priority,
      reason: i.reason,
      resources: i.resources.map((r) => ({
        type: r.type,
        title: r.title,
        url: r.url,
        estimated_hours: r.estimated_hours,
      })),
      milestone: i.milestone,
    }));

    const id = uuid();
    const now = Math.floor(Date.now() / 1000);
    const roadmap: SkillsRoadmap = {
      id,
      job_id: jobId,
      items,
      total_estimated_hours: object.total_estimated_hours,
      summary: object.summary,
      created_at: now,
    };

    if (userId) {
      await db.execute({
        sql: `INSERT INTO skills_roadmaps (id, job_id, user_id, items_json, total_estimated_hours, summary)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          jobId,
          userId,
          JSON.stringify(items),
          roadmap.total_estimated_hours,
          roadmap.summary,
        ],
      });
    }

    return roadmap;
  } catch (err) {
    if (debited && userId) {
      await creditTokens(userId, 1, 'refund', 'ai_failure');
    }
    throw err;
  }
}

export async function getSkillsRoadmap(jobId: string): Promise<SkillsRoadmap | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM skills_roadmaps WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [jobId, userId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    items: JSON.parse(row.items_json as string),
    total_estimated_hours: row.total_estimated_hours as number,
    summary: row.summary as string,
    created_at: row.created_at as number,
  };
}
