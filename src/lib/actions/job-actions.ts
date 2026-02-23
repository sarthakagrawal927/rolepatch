'use server';

import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { JobApplication, TailoredResume } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function createJobApplication(
  resumeId: string,
  url: string,
  company: string,
  role: string,
  jdRaw: string,
  jdText: string,
): Promise<string> {
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO job_applications (id, resume_id, url, company, role, jd_raw, jd_text)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, resumeId, url, company, role, jdRaw, jdText],
  });
  revalidatePath('/');
  return id;
}

export async function getJobApplication(id: string): Promise<JobApplication | null> {
  const result = await db.execute({ sql: 'SELECT * FROM job_applications WHERE id = ?', args: [id] });
  return (result.rows[0] as unknown as JobApplication) ?? null;
}

export async function listJobApplications(): Promise<JobApplication[]> {
  const result = await db.execute('SELECT * FROM job_applications ORDER BY created_at DESC');
  return result.rows as unknown as JobApplication[];
}

export async function saveTailoredResume(
  jobId: string,
  resumeId: string,
  latexSource: string,
): Promise<string> {
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO tailored_resumes (id, job_id, resume_id, latex_source)
          VALUES (?, ?, ?, ?)`,
    args: [id, jobId, resumeId, latexSource],
  });
  await db.execute({
    sql: `UPDATE job_applications SET status = 'tailored', updated_at = unixepoch() WHERE id = ?`,
    args: [jobId],
  });
  revalidatePath('/');
  return id;
}

export async function getTailoredResumes(jobId: string): Promise<TailoredResume[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM tailored_resumes WHERE job_id = ? ORDER BY created_at DESC',
    args: [jobId],
  });
  return result.rows as unknown as TailoredResume[];
}
