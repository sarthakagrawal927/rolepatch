'use server';

import { generateObject } from 'ai';
import { z } from 'zod';

import { formatEvidenceForPrompt, rankEvidenceForJob } from '@/lib/achievement-evidence';
import { listAchievementEvidence } from '@/lib/actions/achievement-evidence-actions';
import { listStashEntries } from '@/lib/actions/stash-actions';
import { creditTokens, debitToken } from '@/lib/actions/token-actions';
import { getAIModel, toUserFacingAIError } from '@/lib/ai';
import { trackActivated, trackCoreAction } from '@/lib/analytics';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { AIProviderConfig, TailorChange } from '@/lib/types';

const tailorSchema = z.object({
  tailored: z.string().describe('The complete modified Markdown resume'),
  changes: z
    .array(
      z.object({
        snippet: z
          .string()
          .describe('A short excerpt from the tailored resume that was added or modified'),
        reason: z.string().describe('Why this edit was made — concise, human-readable'),
        jd_match: z
          .string()
          .optional()
          .describe('The JD keyword, skill, or requirement this edit targets'),
      })
    )
    .describe('One entry per meaningful edit, grounded in the job description'),
});

export interface TailorResult {
  tailored: string;
  changes: TailorChange[];
}

const MAX_RESUME_CHARS = 20_000;
const MAX_JD_CHARS = 15_000;
const MAX_STASH_CHARS = 10_000;

export async function tailorResume(
  resumeSource: string,
  jdText: string,
  aiConfig: AIProviderConfig,
  stashContent?: string
): Promise<TailorResult> {
  resumeSource = resumeSource.slice(0, MAX_RESUME_CHARS);
  jdText = jdText.slice(0, MAX_JD_CHARS);
  if (stashContent) stashContent = stashContent.slice(0, MAX_STASH_CHARS);
  // Debit token before AI call
  const userId = await getCurrentUserId();
  let debited = false;
  if (userId) {
    const result = await debitToken('tailor', 'pending');
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
    let stashSection = '';
    if (stashContent) {
      stashSection = `\n\n## Additional Content Available (not currently in resume):\nThe following are extra content blocks the user has stashed. You may incorporate any of these into the tailored resume if they are relevant to the job description. Only use them if they genuinely strengthen the resume for this specific role.\n\n${stashContent}`;
    }

    const stashEntries = stashContent ? [] : await listStashEntries();
    if (stashEntries.length > 0) {
      const formatted = stashEntries
        .map((e) => `### [${e.category}] ${e.label}\n${e.content}`)
        .join('\n\n');
      stashSection = `\n\n## Additional Content Available (not currently in resume):\nThe following are extra content blocks the user has stashed. You may incorporate any of these into the tailored resume if they are relevant to the job description. Only use them if they genuinely strengthen the resume for this specific role.\n\n${formatted}`;
    }

    if (!stashContent && userId) {
      const evidenceEntries = await listAchievementEvidence();
      const rankedEvidence = rankEvidenceForJob(evidenceEntries, jdText.slice(0, 120), jdText)
        .filter((entry) => entry.quality !== 'weak')
        .slice(0, 6);
      if (rankedEvidence.length > 0) {
        stashSection += `\n\n## Achievement Evidence (verified proof points):\nUse only when relevant and truthful. Prefer strong quantified items.\n\n${formatEvidenceForPrompt(rankedEvidence)}`;
      }
    }

    const { object } = await generateObject({
      model: getAIModel(aiConfig),
      schema: tailorSchema,
      system: `You are a resume tailoring expert. You receive a Markdown resume and a job description. Modify the resume content to better match the job while keeping the Markdown structure intact. Only modify content (summary, experience bullets, skills). Do not change headings or structure.

Return a JSON object with:
- "tailored": the complete modified Markdown resume
- "changes": an array of the meaningful edits you made. For each change provide a short "snippet" from the tailored resume (the new/modified line or phrase, 3-25 words), a "reason" explaining why you made it, and an optional "jd_match" naming the specific JD keyword, skill, or requirement that drove the change. Only include changes that are grounded in the job description — do not list trivial whitespace edits. Aim for 3-10 entries.`,
      prompt: `## Base Resume (Markdown):\n${resumeSource}\n\n## Job Description:\n${jdText}${stashSection}\n\n## Instructions:\n- Emphasize relevant experience and skills that match the JD\n- Reword bullet points to use keywords from the JD where truthful\n- Reorder skills to prioritize those mentioned in the JD\n- If any stashed content is highly relevant to the JD, incorporate it naturally into the appropriate resume section\n- Keep it honest — do not fabricate experience\n- For every edit you make, record a changes entry tying it back to the JD`,
    });

    // Analytics: core action + first-tailor activation. Best-effort, never
    // allowed to fail the request.
    trackCoreAction('tailor_completed', userId ?? undefined);
    if (userId) {
      try {
        const prior = await db.execute({
          sql: 'SELECT 1 FROM tailored_resumes WHERE user_id = ? LIMIT 1',
          args: [userId],
        });
        if (prior.rows.length === 0) {
          trackActivated(userId);
        }
      } catch {
        // Activation check is best-effort.
      }
    }

    return {
      tailored: object.tailored,
      changes: object.changes ?? [],
    };
  } catch (err) {
    // Refund token on AI failure
    if (debited && userId) {
      await creditTokens(userId, 1, 'refund', 'ai_failure');
    }
    // Surface a user-facing, retryable error — never a raw provider stack.
    throw toUserFacingAIError(err);
  }
}
