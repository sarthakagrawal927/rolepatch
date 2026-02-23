'use server';

import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { Resume } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function listResumes(): Promise<Resume[]> {
  const result = await db.execute('SELECT * FROM resumes ORDER BY updated_at DESC');
  return result.rows as unknown as Resume[];
}

export async function getResume(id: string): Promise<Resume | null> {
  const result = await db.execute({ sql: 'SELECT * FROM resumes WHERE id = ?', args: [id] });
  return (result.rows[0] as unknown as Resume) ?? null;
}

export async function createResume(name: string, latexSource: string = ''): Promise<string> {
  const id = uuid();
  await db.execute({
    sql: 'INSERT INTO resumes (id, name, latex_source) VALUES (?, ?, ?)',
    args: [id, name, latexSource],
  });
  revalidatePath('/');
  return id;
}

export async function updateResume(id: string, latexSource: string): Promise<void> {
  await db.execute({
    sql: 'UPDATE resumes SET latex_source = ?, updated_at = unixepoch() WHERE id = ?',
    args: [latexSource, id],
  });
}

export async function deleteResume(id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM resumes WHERE id = ?', args: [id] });
  revalidatePath('/');
}
