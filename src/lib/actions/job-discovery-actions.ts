'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { diffNewJobs } from '@/lib/job-discovery-alerts';
import type { DiscoveredJob } from '@/lib/job-discovery-types';

export interface SavedJobSearchRow {
  id: string;
  name: string;
  query: string;
  location: string;
  remote: number;
  paused: number;
  last_run_at: number | null;
  last_result_ids: string;
  created_at: number;
  updated_at: number;
}

export interface SavedJobShortlistRow {
  id: string;
  external_job_id: string;
  title: string;
  company: string;
  job_url: string;
  location: string;
  saved_at: number;
  last_seen_at: number;
}

export interface JobDiscoveryAlertRow {
  id: string;
  alert_type: string;
  title: string;
  detail: string;
  seen: number;
  created_at: number;
}

export async function listSavedJobSearches(): Promise<SavedJobSearchRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM saved_job_searches WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return JSON.parse(JSON.stringify(result.rows)) as SavedJobSearchRow[];
}

export async function createSavedJobSearch(input: {
  name: string;
  query: string;
  location?: string;
  remote?: boolean;
}): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to save job searches');
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO saved_job_searches (id, user_id, name, query, location, remote)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      userId,
      input.name.trim(),
      input.query.trim(),
      input.location?.trim() ?? '',
      input.remote ? 1 : 0,
    ],
  });
  revalidatePath('/dashboard');
  return id;
}

export async function updateSavedJobSearch(id: string, paused: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update saved searches');
  await db.execute({
    sql: 'UPDATE saved_job_searches SET paused = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?',
    args: [paused ? 1 : 0, id, userId],
  });
  revalidatePath('/dashboard');
}

export async function deleteSavedJobSearch(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to delete saved searches');
  await db.execute({
    sql: 'DELETE FROM saved_job_searches WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  revalidatePath('/dashboard');
}

export async function listSavedJobShortlist(): Promise<SavedJobShortlistRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM saved_job_shortlist WHERE user_id = ? ORDER BY saved_at DESC',
    args: [userId],
  });
  return JSON.parse(JSON.stringify(result.rows)) as SavedJobShortlistRow[];
}

export async function addSavedJobShortlist(job: DiscoveredJob): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to save jobs');
  if (!job.job_url) throw new Error('Job URL required');
  await db.execute({
    sql: `INSERT INTO saved_job_shortlist (id, user_id, external_job_id, title, company, job_url, location)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, job_url) DO UPDATE SET
            title = excluded.title,
            company = excluded.company,
            location = excluded.location,
            last_seen_at = unixepoch()`,
    args: [
      uuid(),
      userId,
      job.id,
      job.title ?? 'Untitled role',
      job.company ?? 'Unknown company',
      job.job_url,
      job.location ?? '',
    ],
  });
  revalidatePath('/dashboard');
}

export async function removeSavedJobShortlist(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to remove saved jobs');
  await db.execute({
    sql: 'DELETE FROM saved_job_shortlist WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  revalidatePath('/dashboard');
}

export async function listJobDiscoveryAlerts(): Promise<JobDiscoveryAlertRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM job_discovery_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    args: [userId],
  });
  return JSON.parse(JSON.stringify(result.rows)) as JobDiscoveryAlertRow[];
}

export async function markJobDiscoveryAlertsSeen(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in required');
  await db.execute({
    sql: 'UPDATE job_discovery_alerts SET seen = 1 WHERE user_id = ? AND seen = 0',
    args: [userId],
  });
  revalidatePath('/dashboard');
}

export async function recordSavedSearchRun(
  searchId: string,
  jobs: DiscoveredJob[]
): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const current = await db.execute({
    sql: 'SELECT last_result_ids FROM saved_job_searches WHERE id = ? AND user_id = ? LIMIT 1',
    args: [searchId, userId],
  });
  const row = current.rows[0] as { last_result_ids?: string } | undefined;
  let previousIds: string[] = [];
  try {
    previousIds = JSON.parse(row?.last_result_ids ?? '[]') as string[];
  } catch {
    previousIds = [];
  }

  const newJobs = diffNewJobs(jobs, previousIds);
  for (const job of newJobs.slice(0, 10)) {
    await db.execute({
      sql: `INSERT INTO job_discovery_alerts (id, user_id, alert_type, title, detail)
            VALUES (?, ?, 'new_match', ?, ?)`,
      args: [
        uuid(),
        userId,
        job.title ?? 'New job match',
        `${job.company ?? 'Company'} · ${job.location ?? 'Location unknown'}`,
      ],
    });
  }

  await db.execute({
    sql: `UPDATE saved_job_searches
          SET last_result_ids = ?, last_run_at = unixepoch(), updated_at = unixepoch()
          WHERE id = ? AND user_id = ?`,
    args: [JSON.stringify(jobs.map((job) => job.id)), searchId, userId],
  });

  revalidatePath('/dashboard');
  return newJobs.length;
}
