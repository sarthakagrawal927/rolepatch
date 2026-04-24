'use server';

import { generateObject } from 'ai';
import { z } from 'zod';
import { getAIModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { OutreachEmail, AIProviderConfig } from '@/lib/types';
import { getCurrentUserId } from '@/lib/auth-utils';
import { debitToken, creditTokens } from '@/lib/actions/token-actions';

export interface OutreachJobInput {
  id: string;
  resume_id: string;
  company: string;
  role: string;
  jd_text: string;
}

const outreachSchema = z.object({
  subject: z.string().max(70),
  body: z.string(),
});

export async function generateOutreachEmail(
  resumeSource: string,
  job: OutreachJobInput,
  aiConfig: AIProviderConfig,
): Promise<{ subject: string; body: string }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to draft outreach emails.');

  const debitResult = await debitToken('outreach_email', job.id);
  if (!debitResult.success) {
    throw new Error(
      debitResult.error === 'insufficient_tokens'
        ? 'No tokens remaining. Purchase more to continue.'
        : 'Authentication required to generate.',
    );
  }

  try {
    const { object } = await generateObject({
      model: getAIModel(aiConfig),
      schema: outreachSchema,
      system: [
        'You write short, warm, professional cold outreach emails for job seekers reaching out to recruiters or hiring managers.',
        'Rules:',
        '- Under 150 words total.',
        '- Body must start with exactly "Hi there,".',
        '- Exactly three short paragraphs: (1) why this role/company excites the candidate, (2) one concrete reason the candidate fits based on their resume, (3) a single clear call to action (e.g. a 15-minute chat).',
        '- No markdown, no bullet points, no headings, no emojis.',
        '- Do NOT include a signature, sign-off line, or placeholders like "[Name]", "[Your Name]", "Best,", or "Regards,".',
        '- Subject line: at most 70 characters, specific, not clickbait.',
      ].join('\n'),
      prompt: `## Candidate Resume\n${resumeSource}\n\n## Role\n${job.role} at ${job.company}\n\n## Job Description\n${job.jd_text}\n\nDraft the email now.`,
    });

    const id = uuid();
    await db.execute({
      sql: `INSERT INTO outreach_emails (id, job_id, resume_id, subject, body, user_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, job.id, job.resume_id, object.subject, object.body, userId],
    });

    return { subject: object.subject, body: object.body };
  } catch (err) {
    await creditTokens(userId, 1, 'refund', 'ai_failure');
    throw err;
  }
}

export async function getOutreachEmail(jobId: string): Promise<OutreachEmail | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM outreach_emails WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [jobId, userId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    resume_id: row.resume_id as string,
    subject: row.subject as string,
    body: row.body as string,
    created_at: row.created_at as number,
  };
}
