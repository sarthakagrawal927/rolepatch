'use server';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { CoverLetter, JobApplication, Resume, StashEntry, TailoredResume } from '@/lib/types';

interface MigrationInput {
  resumes: Resume[];
  jobs: JobApplication[];
  tailoredResumes: TailoredResume[];
  coverLetters: CoverLetter[];
  stashEntries: StashEntry[];
}

interface MigrationResult {
  success: boolean;
  error?: string;
  counts?: {
    resumes: number;
    jobs: number;
    tailoredResumes: number;
    coverLetters: number;
    stashEntries: number;
  };
}

export async function migrateGuestData(input: MigrationInput): Promise<MigrationResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'Not signed in' };

  const counts = { resumes: 0, jobs: 0, tailoredResumes: 0, coverLetters: 0, stashEntries: 0 };

  // 1. Resumes first (jobs reference them)
  for (const r of input.resumes) {
    try {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO resumes (id, name, source, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [r.id, r.name, r.source, userId, r.created_at, r.updated_at],
      });
      counts.resumes++;
    } catch {
      /* skip duplicates */
    }
  }

  // 2. Job applications (reference resumes)
  for (const j of input.jobs) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO job_applications (id, resume_id, url, company, role, jd_raw, jd_text, status, user_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          j.id,
          j.resume_id,
          j.url ?? '',
          j.company,
          j.role,
          j.jd_raw ?? '',
          j.jd_text ?? '',
          j.status ?? 'draft',
          userId,
          j.created_at,
          j.updated_at ?? j.created_at,
        ],
      });
      counts.jobs++;
    } catch {
      /* skip duplicates */
    }
  }

  // 3. Tailored resumes (reference jobs + resumes)
  for (const t of input.tailoredResumes) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO tailored_resumes (id, job_id, resume_id, source, accepted, changes_json, user_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          t.id,
          t.job_id,
          t.resume_id,
          t.source,
          t.accepted,
          JSON.stringify(t.changes ?? []),
          userId,
          t.created_at,
          t.updated_at,
        ],
      });
      counts.tailoredResumes++;
    } catch {
      /* skip duplicates */
    }
  }

  // 4. Cover letters (reference jobs + resumes)
  for (const c of input.coverLetters) {
    try {
      await db.execute({
        sql: `INSERT OR IGNORE INTO cover_letters (id, job_id, resume_id, content, company_research, user_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          c.id,
          c.job_id,
          c.resume_id,
          c.content,
          c.company_research,
          userId,
          c.created_at,
          c.updated_at,
        ],
      });
      counts.coverLetters++;
    } catch {
      /* skip duplicates */
    }
  }

  // 5. Stash entries (standalone)
  for (const s of input.stashEntries) {
    try {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO stash_entries (id, category, label, content, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [s.id, s.category, s.label, s.content, userId, s.created_at, s.updated_at],
      });
      counts.stashEntries++;
    } catch {
      /* skip duplicates */
    }
  }

  return { success: true, counts };
}
