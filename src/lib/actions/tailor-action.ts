'use server';

import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai';
import { listStashEntries } from '@/lib/actions/stash-actions';
import { debitToken, creditTokens } from '@/lib/actions/token-actions';
import { getCurrentUserId } from '@/lib/auth-utils';
import type { AIProviderConfig } from '@/lib/types';

export async function tailorResume(
  resumeSource: string,
  jdText: string,
  aiConfig: AIProviderConfig,
  stashContent?: string,
): Promise<string> {
  // Debit token before AI call
  const userId = await getCurrentUserId();
  let debited = false;
  if (userId) {
    const result = await debitToken('tailor', 'pending');
    if (!result.success) {
      throw new Error(
        result.error === 'insufficient_tokens'
          ? 'No tokens remaining. Purchase more to continue.'
          : 'Authentication required to generate.',
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

    const { text } = await generateText({
      model: getAIModel(aiConfig),
      system: `You are a resume tailoring expert. You receive a Markdown resume and a job description. Modify the resume content to better match the job while keeping the Markdown structure intact. Only modify content (summary, experience bullets, skills). Do not change headings or structure. Return ONLY the complete modified Markdown, no explanation.`,
      prompt: `## Base Resume (Markdown):\n${resumeSource}\n\n## Job Description:\n${jdText}${stashSection}\n\n## Instructions:\n- Emphasize relevant experience and skills that match the JD\n- Reword bullet points to use keywords from the JD where truthful\n- Reorder skills to prioritize those mentioned in the JD\n- If any stashed content is highly relevant to the JD, incorporate it naturally into the appropriate resume section\n- Keep it honest — do not fabricate experience`,
    });

    return text;
  } catch (err) {
    // Refund token on AI failure
    if (debited && userId) {
      await creditTokens(userId, 1, 'refund', 'ai_failure');
    }
    throw err;
  }
}
