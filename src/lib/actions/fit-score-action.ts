'use server';

import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { FitScore, AIProviderConfig } from '@/lib/types';
import { getCurrentUserId } from '@/lib/auth-utils';
import { debitToken, creditTokens } from '@/lib/actions/token-actions';

export async function generateFitScore(
  resumeSource: string,
  jdText: string,
  jobId: string,
  aiConfig: AIProviderConfig,
): Promise<FitScore> {
  const userId = await getCurrentUserId();
  let debited = false;
  if (userId) {
    const result = await debitToken('fit_score', 'pending');
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
    const { text } = await generateText({
      model: getAIModel(aiConfig),
      system: `You are a job fit evaluation expert. Analyze the match between a resume and job description across 5 dimensions. Return ONLY valid JSON, no markdown fences, no explanation.`,
      prompt: `## Resume:\n${resumeSource}\n\n## Job Description:\n${jdText}\n\n## Instructions:\nEvaluate the fit across these 5 weighted dimensions (scores 0-100):\n\n1. Role Alignment (weight: 25) — How well does the candidate's career trajectory and experience match the role's core responsibilities?\n2. Skills Match (weight: 25) — What percentage of required and preferred skills does the resume demonstrate?\n3. Experience Level (weight: 20) — Does the seniority, years of experience, and scope of past work align?\n4. Keyword Coverage (weight: 15) — How well does the resume use the same terminology and keywords as the JD?\n5. Culture & Logistics (weight: 15) — Based on signals in the JD (remote/hybrid/onsite, team size, work style), how well does the candidate fit?\n\nReturn JSON in this exact format:\n{\n  "overall": <weighted_average_0_to_100>,\n  "dimensions": [\n    { "name": "Role Alignment", "score": <0-100>, "weight": 25, "detail": "<1-2 sentences>" },\n    { "name": "Skills Match", "score": <0-100>, "weight": 25, "detail": "<1-2 sentences>" },\n    { "name": "Experience Level", "score": <0-100>, "weight": 20, "detail": "<1-2 sentences>" },\n    { "name": "Keyword Coverage", "score": <0-100>, "weight": 15, "detail": "<1-2 sentences>" },\n    { "name": "Culture & Logistics", "score": <0-100>, "weight": 15, "detail": "<1-2 sentences>" }\n  ],\n  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],\n  "gaps": ["<gap 1>", "<gap 2>"],\n  "recommendation": "<2-3 sentence actionable recommendation>"\n}`,
    });

    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());

    const id = uuid();
    const now = Math.floor(Date.now() / 1000);
    const fitScore: FitScore = {
      id,
      job_id: jobId,
      overall_score: Math.round(parsed.overall),
      dimensions: parsed.dimensions,
      strengths: parsed.strengths,
      gaps: parsed.gaps,
      recommendation: parsed.recommendation,
      created_at: now,
    };

    if (userId) {
      await db.execute({
        sql: `INSERT INTO fit_scores (id, job_id, user_id, overall_score, dimensions, strengths, gaps, recommendation)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, jobId, userId,
          fitScore.overall_score,
          JSON.stringify(fitScore.dimensions),
          JSON.stringify(fitScore.strengths),
          JSON.stringify(fitScore.gaps),
          fitScore.recommendation,
        ],
      });
    }

    return fitScore;
  } catch (err) {
    if (debited && userId) {
      await creditTokens(userId, 1, 'refund', 'ai_failure');
    }
    throw err;
  }
}

export async function getFitScore(jobId: string): Promise<FitScore | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM fit_scores WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [jobId, userId],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    overall_score: row.overall_score as number,
    dimensions: JSON.parse(row.dimensions as string),
    strengths: JSON.parse(row.strengths as string),
    gaps: JSON.parse(row.gaps as string),
    recommendation: row.recommendation as string,
    created_at: row.created_at as number,
  };
}

export async function listFitScores(jobIds: string[]): Promise<Record<string, number>> {
  const userId = await getCurrentUserId();
  if (!userId || jobIds.length === 0) return {};
  const placeholders = jobIds.map(() => '?').join(',');
  const result = await db.execute({
    sql: `SELECT job_id, overall_score FROM fit_scores WHERE user_id = ? AND job_id IN (${placeholders}) ORDER BY created_at DESC`,
    args: [userId, ...jobIds],
  });
  const scores: Record<string, number> = {};
  for (const row of result.rows) {
    const jobId = row.job_id as string;
    if (!(jobId in scores)) {
      scores[jobId] = row.overall_score as number;
    }
  }
  return scores;
}
