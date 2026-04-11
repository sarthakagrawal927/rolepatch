'use server';

import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { CoverLetter, AIProviderConfig } from '@/lib/types';
import { scrapeJobUrl } from './scrape-action';
import { getCurrentUserId } from '@/lib/auth-utils';
import { debitToken, creditTokens } from '@/lib/actions/token-actions';

async function researchCompany(companyUrl: string): Promise<string> {
  try {
    const result = await scrapeJobUrl(companyUrl);
    return result.text;
  } catch {
    return '';
  }
}

export async function generateCoverLetter(
  resumeSource: string,
  jdText: string,
  company: string,
  jobId: string,
  resumeId: string,
  aiConfig: AIProviderConfig,
): Promise<string> {
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

    const { text } = await generateText({
      model: getAIModel(aiConfig),
      system: `You are a professional cover letter writer. Using the candidate's resume, the job description, and research about the company, write a compelling cover letter. Return ONLY the cover letter text, no explanation.`,
      prompt: `## Resume:\n${resumeSource}\n\n## Job Description:\n${jdText}\n\n## Company Research:\n${companyResearch || 'No research available.'}\n\n## Instructions:\n- Connect candidate's experience to the specific role\n- Reference company values/mission where genuine\n- Keep it concise (3-4 paragraphs)\n- Professional but not generic`,
    });

    // Save to DB
    const id = uuid();
    await db.execute({
      sql: `INSERT INTO cover_letters (id, job_id, resume_id, content, company_research, user_id)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, jobId, resumeId, text, companyResearch, userId],
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
