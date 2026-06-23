import type { DiscoveredJob } from '@/lib/job-discovery-types';

export interface SavedJobSearch {
  id: string;
  name: string;
  query: string;
  location?: string;
  remote?: boolean;
  paused: boolean;
  last_run_at?: number;
  created_at: number;
  updated_at: number;
}

export interface SavedJobShortlistItem {
  id: string;
  job_id: string;
  title: string;
  company: string;
  job_url: string;
  location?: string;
  saved_at: number;
  last_seen_at: number;
}

export interface JobDiscoveryAlert {
  id: string;
  type: 'new_match' | 'follow_up';
  title: string;
  detail: string;
  created_at: number;
  seen: boolean;
}

export function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

export function isDuplicateJob(url: string, existingUrls: string[]): boolean {
  const normalized = normalizeJobUrl(url);
  return existingUrls.some((item) => normalizeJobUrl(item) === normalized);
}

export function rankDiscoveredJobs(jobs: DiscoveredJob[], query: string): DiscoveredJob[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return [...jobs].sort((a, b) => scoreJob(b, terms) - scoreJob(a, terms));
}

function scoreJob(job: DiscoveredJob, terms: string[]): number {
  const haystack =
    `${job.title ?? ''} ${job.company ?? ''} ${job.description_short ?? ''}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 10;
  }
  if (job.date_posted) {
    const posted = Date.parse(job.date_posted);
    if (!Number.isNaN(posted))
      score += Math.max(0, 14 - Math.floor((Date.now() - posted) / 86400000));
  }
  if (job.is_remote) score += 2;
  return score;
}

export function diffNewJobs(current: DiscoveredJob[], previousIds: string[]): DiscoveredJob[] {
  const known = new Set(previousIds);
  return current.filter((job) => !known.has(job.id));
}
