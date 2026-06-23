'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { StashEntry } from '@/lib/types';

export async function listStashEntries(): Promise<StashEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM stash_entries WHERE user_id = ? ORDER BY category, created_at DESC',
    args: [userId],
  });
  return JSON.parse(JSON.stringify(result.rows)) as StashEntry[];
}

export async function createStashEntry(
  category: string,
  label: string,
  content: string
): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to create stash entries');
  const id = uuid();
  await db.execute({
    sql: 'INSERT INTO stash_entries (id, category, label, content, user_id) VALUES (?, ?, ?, ?, ?)',
    args: [id, category, label, content, userId],
  });
  revalidatePath('/stash');
  return id;
}

export async function updateStashEntry(
  id: string,
  category: string,
  label: string,
  content: string
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update stash entries');
  await db.execute({
    sql: 'UPDATE stash_entries SET category = ?, label = ?, content = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?',
    args: [category, label, content, id, userId],
  });
  revalidatePath('/stash');
}

export async function deleteStashEntry(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to delete stash entries');
  await db.execute({
    sql: 'DELETE FROM stash_entries WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  revalidatePath('/stash');
}
