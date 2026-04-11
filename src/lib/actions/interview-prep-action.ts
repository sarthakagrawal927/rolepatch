'use server';

import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { InterviewStory, AIProviderConfig } from '@/lib/types';
import { getCurrentUserId } from '@/lib/auth-utils';
import { debitToken, creditTokens } from '@/lib/actions/token-actions';

export async function generateInterviewStories(
  resumeSource: string,
  jdText: string,
  jobId: string,
  aiConfig: AIProviderConfig,
): Promise<InterviewStory[]> {
  const userId = await getCurrentUserId();
  let debited = false;
  if (userId) {
    const result = await debitToken('interview_prep', 'pending');
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
      system: `You are an interview preparation expert. Generate STAR+R (Situation, Task, Action, Result, Reflection) stories that map a candidate's resume experience to specific job requirements. Each story must use real details from the resume — never fabricate experience. Include quantified results where the resume provides metrics. Return ONLY valid JSON, no markdown fences.`,
      prompt: `## Resume:\n${resumeSource}\n\n## Job Description:\n${jdText}\n\n## Instructions:\nGenerate 5-7 STAR+R interview stories. Each story should:\n- Map to a specific requirement or qualification from the JD\n- Draw from real experience in the resume (never invent)\n- Include quantified results where the resume provides metrics\n- Add a reflection that signals senior-level thinking (lessons learned, what you'd do differently)\n- List 2-4 behavioral question types this story can answer\n\nReturn a JSON array:\n[\n  {\n    "theme": "<short theme, e.g. 'Technical Leadership'>",\n    "jd_requirement": "<the specific JD requirement this addresses>",\n    "situation": "<2-3 sentences: context and background>",\n    "task": "<1-2 sentences: what needed to be accomplished>",\n    "action": "<2-3 sentences: specific steps you took>",\n    "result": "<1-2 sentences: quantified outcome>",\n    "reflection": "<1-2 sentences: what you learned or would do differently>",\n    "best_for": ["<question type 1>", "<question type 2>", "<question type 3>"]\n  }\n]`,
    });

    const parsed: Record<string, unknown>[] = JSON.parse(
      text.replace(/```json\n?|\n?```/g, '').trim(),
    );
    const now = Math.floor(Date.now() / 1000);

    const stories: InterviewStory[] = parsed.map((s) => ({
      id: uuid(),
      job_id: jobId,
      theme: (s.theme as string) ?? '',
      jd_requirement: (s.jd_requirement as string) ?? '',
      situation: (s.situation as string) ?? '',
      task: (s.task as string) ?? '',
      action: (s.action as string) ?? '',
      result: (s.result as string) ?? '',
      reflection: (s.reflection as string) ?? '',
      best_for: (s.best_for as string[]) ?? [],
      created_at: now,
    }));

    if (userId) {
      for (const story of stories) {
        await db.execute({
          sql: `INSERT INTO interview_stories (id, job_id, user_id, theme, jd_requirement, situation, task, action, result, reflection, best_for)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            story.id, jobId, userId,
            story.theme, story.jd_requirement,
            story.situation, story.task, story.action, story.result,
            story.reflection, JSON.stringify(story.best_for),
          ],
        });
      }
    }

    return stories;
  } catch (err) {
    if (debited && userId) {
      await creditTokens(userId, 1, 'refund', 'ai_failure');
    }
    throw err;
  }
}

export async function getInterviewStories(jobId: string): Promise<InterviewStory[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM interview_stories WHERE job_id = ? AND user_id = ? ORDER BY created_at ASC',
    args: [jobId, userId],
  });
  return result.rows.map((row) => ({
    id: row.id as string,
    job_id: row.job_id as string,
    theme: row.theme as string,
    jd_requirement: row.jd_requirement as string,
    situation: row.situation as string,
    task: row.task as string,
    action: row.action as string,
    result: row.result as string,
    reflection: row.reflection as string,
    best_for: JSON.parse(row.best_for as string),
    created_at: row.created_at as number,
  }));
}
