'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { ProfileAnswer, ProfileAnswerCategory } from '@/lib/types';

const PROFILE_ANSWER_CATEGORIES = new Set<ProfileAnswerCategory>([
  'identity',
  'work_authorization',
  'sponsorship',
  'location',
  'salary',
  'links',
  'open_ended',
  'other',
]);

function normalizeCategory(category: string): ProfileAnswerCategory {
  return PROFILE_ANSWER_CATEGORIES.has(category as ProfileAnswerCategory)
    ? (category as ProfileAnswerCategory)
    : 'other';
}

export async function listProfileAnswers(): Promise<ProfileAnswer[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT id, category, label, answer, sensitive, created_at, updated_at FROM profile_answers WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return JSON.parse(JSON.stringify(result.rows)) as ProfileAnswer[];
}

export async function saveProfileAnswer(input: {
  id?: string;
  category: string;
  label: string;
  answer: string;
  sensitive?: boolean;
}): Promise<ProfileAnswer> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to save profile answers');
  const label = input.label.trim();
  const answer = input.answer.trim();
  if (!label || !answer) throw new Error('Profile answer label and answer are required');

  const id = input.id ?? uuid();
  await db.execute({
    sql: `INSERT INTO profile_answers (id, user_id, category, label, answer, sensitive)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            category = excluded.category,
            label = excluded.label,
            answer = excluded.answer,
            sensitive = excluded.sensitive,
            updated_at = unixepoch()`,
    args: [id, userId, normalizeCategory(input.category), label, answer, input.sensitive ? 1 : 0],
  });
  revalidatePath('/dashboard');

  const result = await db.execute({
    sql: 'SELECT id, category, label, answer, sensitive, created_at, updated_at FROM profile_answers WHERE id = ? AND user_id = ? LIMIT 1',
    args: [id, userId],
  });
  return JSON.parse(JSON.stringify(result.rows[0])) as ProfileAnswer;
}

export async function deleteProfileAnswer(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to delete profile answers');
  await db.execute({
    sql: 'DELETE FROM profile_answers WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  revalidatePath('/dashboard');
}
