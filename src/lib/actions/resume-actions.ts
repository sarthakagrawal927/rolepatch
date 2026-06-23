'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { Resume } from '@/lib/types';

export async function listResumes(): Promise<Resume[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return JSON.parse(JSON.stringify(result.rows)) as Resume[];
}

export async function getResume(id: string): Promise<Resume | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM resumes WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  const row = result.rows[0];
  return row ? (JSON.parse(JSON.stringify(row)) as Resume) : null;
}

const DEFAULT_MARKDOWN_TEMPLATE = `# Your Name

your.email@example.com | (555) 123-4567 | City, ST
[LinkedIn](https://linkedin.com/in/yourprofile) | [GitHub](https://github.com/yourprofile)

---

## Experience

**Job Title** — _Company Name_ | Start – End

- Accomplishment or responsibility
- Another accomplishment with measurable impact

## Education

**Degree, Major** — _University Name_ | Graduation Year

Relevant coursework or honors

## Skills

**Languages:** JavaScript, TypeScript, Python
**Frameworks:** React, Next.js, Node.js
**Tools:** Git, Docker, AWS
`;

export async function createResume(
  name: string,
  source: string = DEFAULT_MARKDOWN_TEMPLATE
): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to create resumes');
  const id = uuid();
  await db.execute({
    sql: 'INSERT INTO resumes (id, name, source, user_id) VALUES (?, ?, ?, ?)',
    args: [id, name, source, userId],
  });
  revalidatePath('/');
  return id;
}

export async function updateResume(id: string, source: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update resumes');
  await db.execute({
    sql: 'UPDATE resumes SET source = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?',
    args: [source, id, userId],
  });
}

export async function deleteResume(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to delete resumes');
  await db.execute({
    sql: 'DELETE FROM resumes WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  revalidatePath('/');
}
