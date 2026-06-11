'use server';

import { generateText } from 'ai';
import { v4 as uuid } from 'uuid';

import { creditTokens,debitToken } from '@/lib/actions/token-actions';
import { getAIModel, toUserFacingAIError } from '@/lib/ai';
import { trackCoreAction } from '@/lib/analytics';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { AIProviderConfig,CoverLetter } from '@/lib/types';

import { scrapeJobUrl } from './scrape-action';

export type CoverLetterTone = 'formal' | 'conversational' | 'enthusiastic';
export type CoverLetterLength = 'short' | 'medium' | 'long';

export interface CoverLetterOptions {
  tone?: CoverLetterTone;
  length?: CoverLetterLength;
  userFeedback?: string;
  previousDraft?: string;
}

const TONE_GUIDANCE: Record<CoverLetterTone, string> = {
  formal: 'Use a formal, polished tone. Professional vocabulary, measured phrasing, no contractions.',
  conversational: 'Use a warm, conversational tone. Natural phrasing, contractions allowed, approachable but professional.',
  enthusiastic: 'Use an enthusiastic, high-energy tone. Convey genuine excitement about the role and company without sounding desperate.',
};

const LENGTH_GUIDANCE: Record<CoverLetterLength, { words: number; label: string }> = {
  short: { words: 150, label: 'Concise — around 150 words, 2 tight paragraphs.' },
  medium: { words: 250, label: 'Standard — around 250 words, 3 paragraphs.' },
  long: { words: 400, label: 'Detailed — around 400 words, 3-4 substantial paragraphs.' },
};

async function researchCompany(companyUrl: string): Promise<string> {
  try {
    const result = await scrapeJobUrl(companyUrl);
    return result.text;
  } catch {
    return '';
  }
}

const MAX_RESUME_CHARS = 20_000;
const MAX_JD_CHARS = 15_000;
const MAX_FEEDBACK_CHARS = 2_000;
const MAX_DRAFT_CHARS = 5_000;

export async function generateCoverLetter(
  resumeSource: string,
  jdText: string,
  company: string,
  jobId: string,
  resumeId: string,
  aiConfig: AIProviderConfig,
  options: CoverLetterOptions = {},
): Promise<string> {
  resumeSource = resumeSource.slice(0, MAX_RESUME_CHARS);
  jdText = jdText.slice(0, MAX_JD_CHARS);
  const tone: CoverLetterTone = options.tone ?? 'conversational';
  const length: CoverLetterLength = options.length ?? 'medium';
  const userFeedback = options.userFeedback?.slice(0, MAX_FEEDBACK_CHARS);
  const previousDraft = options.previousDraft?.slice(0, MAX_DRAFT_CHARS);

  // Debit token before AI call
  const userId = await getCurrentUserId();
  let debited = false;
  if (userId) {
    const result = await debitToken('cover_letter', 'pending');
    if (!result.success) {
      throw new Error(
        result.error === 'insufficient_tokens'
          ? 'No tokens remaining. Purchase more to continue.'
          : 'Authentication required to generate.',
      );
    }
    debited = true;
  }

  if (!userId) {
    throw new Error('Authentication required to generate.');
  }

  const ownershipCheck = await db.execute({
    sql: `SELECT 1
          FROM job_applications ja
          JOIN resumes r ON r.id = ?
          WHERE ja.id = ? AND ja.user_id = ? AND r.user_id = ?`,
    args: [resumeId, jobId, userId, userId],
  });
  if (ownershipCheck.rows.length === 0) {
    throw new Error('Job or resume not found');
  }

  try {
    // Research company
    let companyResearch = '';
    const domain = company.toLowerCase().replace(/\s+/g, '');
    const searchUrls = [
      `https://www.${domain}.com/about`,
      `https://www.${domain}.com/careers`,
    ];
    for (const url of searchUrls) {
      const research = await researchCompany(url);
      if (research) {
        companyResearch += research + '\n\n';
      }
    }

    const toneGuidance = TONE_GUIDANCE[tone];
    const lengthGuidance = LENGTH_GUIDANCE[length];

    const system = `You are a professional cover letter writer. Using the candidate's resume, the job description, and research about the company, write a compelling cover letter.
Tone: ${toneGuidance}
Length: ${lengthGuidance.label}
Return ONLY the cover letter text, no explanation, no preamble, no sign-off placeholders like [Your Name].`;

    const promptParts = [
      `## Resume:\n${resumeSource}`,
      `## Job Description:\n${jdText}`,
      `## Company Research:\n${companyResearch || 'No research available.'}`,
    ];

    if (previousDraft) {
      promptParts.push(`## Previous Draft:\n${previousDraft}`);
    }
    if (userFeedback) {
      promptParts.push(`## User Feedback (apply these changes to the rewrite):\n${userFeedback}`);
    }

    promptParts.push(
      [
        '## Instructions:',
        '- Connect candidate\'s experience to the specific role',
        '- Reference company values/mission where genuine',
        `- Target approximately ${lengthGuidance.words} words`,
        '- Professional but not generic',
        previousDraft
          ? '- Rewrite the previous draft incorporating the user feedback; preserve what works, change what the feedback asks for'
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );

    const { text } = await generateText({
      model: getAIModel(aiConfig),
      system,
      prompt: promptParts.join('\n\n'),
    });

    // Save to DB
    const id = uuid();
    await db.execute({
      sql: `INSERT INTO cover_letters (id, job_id, resume_id, content, company_research, user_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, jobId, resumeId, text, companyResearch, userId],
    });

    trackCoreAction('cover_letter_generated', userId ?? undefined);

    return text;
  } catch (err) {
    // Refund token on AI failure
    if (debited && userId) {
      await creditTokens(userId, 1, 'refund', 'ai_failure');
    }
    // Surface a user-facing, retryable error — never a raw provider stack.
    throw toUserFacingAIError(err);
  }
}

export async function getCoverLetter(jobId: string): Promise<CoverLetter | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM cover_letters WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [jobId, userId],
  });
  return (result.rows[0] as unknown as CoverLetter) ?? null;
}

export async function updateCoverLetter(id: string, content: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update cover letters');
  await db.execute({
    sql: 'UPDATE cover_letters SET content = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?',
    args: [content, id, userId],
  });
}
