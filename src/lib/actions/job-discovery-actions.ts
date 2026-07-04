'use server';

import { revalidatePath } from 'next/cache';
import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { type CareerDiscoverySource, discoverCompanyCareerJobs } from '@/lib/company-career-watch';
import { db } from '@/lib/db';
import { diffNewJobs } from '@/lib/job-discovery-alerts';
import type { DiscoveredJob } from '@/lib/job-discovery-types';
import { searchJobs } from '@/lib/job-search';
import type { CompanyWatch } from '@/lib/types';

export interface SavedJobSearchRow {
  id: string;
  name: string;
  query: string;
  location: string;
  remote: number;
  paused: number;
  last_run_at: number | null;
  last_result_ids: string;
  last_source?: string | null;
  last_found_count?: number | null;
  last_error?: string | null;
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
  external_job_id: string | null;
  company: string | null;
  job_url: string | null;
  location: string | null;
  source: string | null;
  seen: number;
  created_at: number;
}

export interface CompanyWatchDbRow {
  id: string;
  user_id: string;
  company: string;
  career_url: string | null;
  role_query: string;
  location: string;
  remote: number;
  paused: number;
  last_run_at: number | null;
  last_result_ids: string;
  last_source: string | null;
  last_found_count: number | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

function parseResultIds(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toCompanyWatch(row: CompanyWatchDbRow): CompanyWatch {
  return {
    id: row.id,
    company: row.company,
    career_url: row.career_url,
    role_query: row.role_query,
    location: row.location,
    remote: row.remote === 1,
    paused: row.paused === 1,
    last_run_at: row.last_run_at,
    last_result_ids: parseResultIds(row.last_result_ids),
    last_source: row.last_source ?? null,
    last_found_count: row.last_found_count ?? null,
    last_error: row.last_error ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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

export async function listCompanyWatches(): Promise<CompanyWatch[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: 'SELECT * FROM company_watches WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return (JSON.parse(JSON.stringify(result.rows)) as CompanyWatchDbRow[]).map(toCompanyWatch);
}

export async function createCompanyWatch(input: {
  company: string;
  careerUrl?: string;
  roleQuery?: string;
  location?: string;
  remote?: boolean;
}): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to save company watches');
  const company = input.company.trim();
  if (!company) throw new Error('Company is required');
  const id = uuid();
  await db.execute({
    sql: `INSERT INTO company_watches
            (id, user_id, company, career_url, role_query, location, remote)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      userId,
      company,
      input.careerUrl?.trim() || null,
      input.roleQuery?.trim() || '',
      input.location?.trim() || '',
      input.remote ? 1 : 0,
    ],
  });
  revalidatePath('/dashboard');
  return id;
}

export async function updateCompanyWatch(id: string, paused: boolean): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update company watches');
  await db.execute({
    sql: 'UPDATE company_watches SET paused = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?',
    args: [paused ? 1 : 0, id, userId],
  });
  revalidatePath('/dashboard');
}

export async function deleteCompanyWatch(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to delete company watches');
  await db.execute({
    sql: 'DELETE FROM company_watches WHERE id = ? AND user_id = ?',
    args: [id, userId],
  });
  revalidatePath('/dashboard');
}

export async function runCompanyWatch(id: string): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to run company watches');
  const result = await db.execute({
    sql: 'SELECT * FROM company_watches WHERE id = ? AND user_id = ? LIMIT 1',
    args: [id, userId],
  });
  const row = JSON.parse(JSON.stringify(result.rows[0] ?? null)) as CompanyWatchDbRow | null;
  if (!row) throw new Error('Company watch not found');
  const count = await runCompanyWatchForUser(toCompanyWatch(row), userId);
  revalidatePath('/dashboard');
  return count;
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
  for (const job of newJobs) {
    await db.execute({
      sql: `INSERT INTO job_discovery_alerts (
              id, user_id, alert_type, title, detail, external_job_id, company, job_url, location, source
            )
            VALUES (?, ?, 'new_match', ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuid(),
        userId,
        job.title ?? 'New job match',
        `${job.company ?? 'Company'} · ${job.location ?? 'Location unknown'}`,
        job.id,
        job.company ?? null,
        job.job_url ?? null,
        job.location ?? null,
        job.site ?? 'saved_search',
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

export async function runCompanyWatchForUser(watch: CompanyWatch, userId: string): Promise<number> {
  const query = [watch.company, watch.role_query].filter(Boolean).join(' ').trim();
  if (!query) return 0;

  let jobs: DiscoveredJob[] = [];
  let source: CareerDiscoverySource | 'linkedin' | 'linkedin_fallback' = 'linkedin';
  let runError: string | null = null;
  if (watch.career_url) {
    try {
      const careerResult = await discoverCompanyCareerJobs(watch);
      jobs = careerResult?.jobs ?? [];
      if (careerResult) source = careerResult.source;
    } catch (err) {
      runError = err instanceof Error ? err.message : String(err);
      source = 'linkedin_fallback';
      console.error(`[company-watch] career URL ${watch.career_url} failed`, err);
    }
  }

  if (jobs.length === 0) {
    const result = await searchJobs({
      query,
      location: watch.location || null,
      remote: watch.remote,
      results_wanted: 25,
      hours_old: 24 * 7,
    });
    jobs = result.jobs as DiscoveredJob[];
    if (watch.career_url && source !== 'linkedin_fallback') source = 'linkedin_fallback';
  }

  const newJobs = diffNewJobs(jobs, watch.last_result_ids);

  for (const job of newJobs) {
    await db.execute({
      sql: `INSERT INTO job_discovery_alerts (
              id, user_id, alert_type, title, detail, external_job_id, company, job_url, location, source
            )
            VALUES (?, ?, 'company_watch', ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuid(),
        userId,
        job.title ?? `${watch.company} role`,
        `${job.company ?? watch.company} · ${job.location ?? 'Location unknown'}`,
        job.id,
        job.company ?? watch.company,
        job.job_url ?? null,
        job.location ?? null,
        source,
      ],
    });
  }

  await db.execute({
    sql: `UPDATE company_watches
          SET last_result_ids = ?,
              last_run_at = unixepoch(),
              last_source = ?,
              last_found_count = ?,
              last_error = ?,
              updated_at = unixepoch()
          WHERE id = ? AND user_id = ?`,
    args: [
      JSON.stringify(jobs.map((job) => job.id)),
      source,
      jobs.length,
      runError,
      watch.id,
      userId,
    ],
  });

  return newJobs.length;
}
