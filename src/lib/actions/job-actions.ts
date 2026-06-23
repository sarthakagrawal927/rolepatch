'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { JobApplication, JobDetailsPatch, TailorChange, TailoredResume } from '@/lib/types';

type SqlArg = string | number | null;

const ALLOWED_DETAIL_FIELDS: ReadonlyArray<keyof JobDetailsPatch> = [
  'interview_date',
  'follow_up_at',
  'salary_min',
  'salary_max',
  'salary_currency',
  'offer_amount',
  'notes',
  'rejection_reason',
];

export async function createJobApplication(
  resumeId: string,
  url: string,
  company: string,
  role: string,
  jdRaw: string,
  jdText: string
): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to create job applications');
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO job_applications (id, resume_id, url, company, role, jd_raw, jd_text, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, resumeId, url, company, role, jdRaw, jdText, userId],
  });
  revalidatePath('/');
  return id;
}

export async function getJobApplication(id: string): Promise<JobApplication | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const result = await db.execute({
    sql: 'SELECT * FROM job_applications WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  const row = result.rows[0];
  return row ? (JSON.parse(JSON.stringify(row)) as JobApplication) : null;
}

export async function listJobApplications(): Promise<JobApplication[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM job_applications WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  });
  return JSON.parse(JSON.stringify(result.rows)) as JobApplication[];
}

const ALLOWED_JOB_STATUSES = new Set([
  'draft',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
]);

export async function updateJobStatus(id: string, status: string): Promise<void> {
  if (!ALLOWED_JOB_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update job status');
  await db.execute({
    sql: `UPDATE job_applications SET status = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?`,
    args: [status, id, userId],
  });
  revalidatePath('/dashboard');
}

export async function updateJobDetails(id: string, patch: JobDetailsPatch): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update job details');

  const sets: string[] = [];
  const args: SqlArg[] = [];
  for (const field of ALLOWED_DETAIL_FIELDS) {
    if (field in patch) {
      const value = patch[field];
      if (value === undefined) continue;
      sets.push(`${field} = ?`);
      args.push(value);
    }
  }
  if (sets.length === 0) return;

  sets.push(`updated_at = unixepoch()`);
  args.push(id, userId);

  await db.execute({
    sql: `UPDATE job_applications SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    args,
  });
  revalidatePath('/dashboard');
}

export async function saveTailoredResume(
  jobId: string,
  resumeId: string,
  source: string,
  changes: TailorChange[] = []
): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to save tailored resumes');
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO tailored_resumes (id, job_id, resume_id, source, changes_json, user_id)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, jobId, resumeId, source, JSON.stringify(changes ?? []), userId],
  });
  await db.execute({
    sql: `UPDATE job_applications SET status = 'tailored', updated_at = unixepoch() WHERE id = ? AND user_id = ?`,
    args: [jobId, userId],
  });
  revalidatePath('/');
  return id;
}

export async function getTailoredResumes(jobId: string): Promise<TailoredResume[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM tailored_resumes WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC',
    args: [jobId, userId],
  });
  const rows = JSON.parse(JSON.stringify(result.rows)) as Array<
    Omit<TailoredResume, 'changes'> & { changes_json?: string }
  >;
  return rows.map((row) => {
    let changes: TailorChange[] = [];
    if (row.changes_json) {
      try {
        const parsed = JSON.parse(row.changes_json);
        if (Array.isArray(parsed)) changes = parsed as TailorChange[];
      } catch {
        /* ignore malformed json */
      }
    }
    const { changes_json: _omit, ...rest } = row;
    void _omit;
    return { ...rest, changes } as TailoredResume;
  });
}
