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
  type: 'new_match' | 'company_watch' | 'follow_up';
  title: string;
  detail: string;
  external_job_id?: string | null;
  company?: string | null;
  job_url?: string | null;
  location?: string | null;
  source?: string | null;
  created_at: number;
  seen: boolean;
}

interface DiscoverySummaryAlert {
  source?: string | null;
  seen: boolean | number;
}

interface DiscoverySummaryWatch {
  paused?: boolean | number;
  last_source?: string | null;
  last_found_count?: number | null;
  last_error?: string | null;
}

export interface DiscoveryEngagementSummary {
  savedSearches: number;
  activeSavedSearches: number;
  companyWatches: number;
  activeCompanyWatches: number;
  shortlist: number;
  alerts: number;
  unseenAlerts: number;
  watchedRolesFound: number;
  sources: Array<{ source: string; count: number }>;
  watchesWithFallback: number;
  latestSource: string | null;
  sourceDecision: {
    status: 'setup' | 'collecting' | 'healthy' | 'needs_attention';
    label: string;
    detail: string;
  };
}

function activeCount(items: Array<{ paused?: boolean | number }>): number {
  return items.filter((item) => !item.paused).length;
}

export function buildDiscoveryEngagementSummary(input: {
  savedSearches: Array<{ paused?: boolean | number }>;
  companyWatches: DiscoverySummaryWatch[];
  shortlist: unknown[];
  alerts: DiscoverySummaryAlert[];
}): DiscoveryEngagementSummary {
  const sourceCounts = new Map<string, number>();
  for (const alert of input.alerts) {
    if (!alert.source) continue;
    sourceCounts.set(alert.source, (sourceCounts.get(alert.source) ?? 0) + 1);
  }
  for (const watch of input.companyWatches) {
    if (!watch.last_source) continue;
    sourceCounts.set(watch.last_source, (sourceCounts.get(watch.last_source) ?? 0) + 1);
  }

  const sources = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  const activeSavedSearches = activeCount(input.savedSearches);
  const activeCompanyWatches = activeCount(input.companyWatches);
  const watchedRolesFound = input.companyWatches.reduce(
    (sum, watch) => sum + Math.max(0, watch.last_found_count ?? 0),
    0
  );
  const watchesWithFallback = input.companyWatches.filter((watch) =>
    Boolean(watch.last_error)
  ).length;
  const sourceDecision = buildSourceDecision({
    activeSavedSearches,
    activeCompanyWatches,
    alerts: input.alerts.length,
    watchedRolesFound,
    watchesWithFallback,
    sources,
  });

  return {
    savedSearches: input.savedSearches.length,
    activeSavedSearches,
    companyWatches: input.companyWatches.length,
    activeCompanyWatches,
    shortlist: input.shortlist.length,
    alerts: input.alerts.length,
    unseenAlerts: input.alerts.filter((alert) => !alert.seen).length,
    watchedRolesFound,
    sources,
    watchesWithFallback,
    latestSource: sources[0]?.source ?? null,
    sourceDecision,
  };
}

function buildSourceDecision(input: {
  activeSavedSearches: number;
  activeCompanyWatches: number;
  alerts: number;
  watchedRolesFound: number;
  watchesWithFallback: number;
  sources: Array<{ source: string; count: number }>;
}): DiscoveryEngagementSummary['sourceDecision'] {
  if (input.activeSavedSearches + input.activeCompanyWatches === 0) {
    return {
      status: 'setup',
      label: 'Set up discovery',
      detail: 'Add saved searches or company watches before judging source coverage.',
    };
  }

  if (input.watchesWithFallback > 0) {
    return {
      status: 'needs_attention',
      label: 'Fix fallback sources',
      detail:
        'Some company watches needed fallback. Review career URLs before adding more providers.',
    };
  }

  if (input.alerts === 0 && input.watchedRolesFound === 0) {
    return {
      status: 'collecting',
      label: 'Collect more runs',
      detail: 'Run saved searches or company checks before expanding job-board coverage.',
    };
  }

  const topSource = input.sources[0];
  return {
    status: 'healthy',
    label: 'Keep current sources',
    detail: topSource
      ? `${topSource.source} is producing the most signal. Tune ranking before broadening sources.`
      : 'Current discovery is producing signal. Tune ranking before broadening sources.',
  };
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

export interface JobSignal {
  id: 'remote' | 'visa' | 'new_grad' | 'senior' | 'leadership' | 'contract';
  label: string;
}

const SIGNAL_RULES: Array<{
  id: JobSignal['id'];
  label: string;
  pattern: RegExp;
}> = [
  { id: 'visa', label: 'Visa signal', pattern: /\b(h-?1b|visa|sponsor(?:ship)?|opt|cpt)\b/i },
  {
    id: 'new_grad',
    label: 'New grad',
    pattern: /\b(new grad|new graduate|entry[- ]level|junior|early career|university grad)\b/i,
  },
  { id: 'senior', label: 'Senior', pattern: /\b(senior|staff|principal|sr\.)\b/i },
  { id: 'leadership', label: 'Lead', pattern: /\b(lead|manager|director|head of)\b/i },
  { id: 'contract', label: 'Contract', pattern: /\b(contract|contractor|temporary|temp)\b/i },
];

export function inferJobSignals(job: DiscoveredJob): JobSignal[] {
  const haystack = [
    job.title,
    job.company,
    job.location,
    job.job_type,
    job.description_short,
    job.description,
  ]
    .filter(Boolean)
    .join(' ');
  const signals: JobSignal[] = [];
  if (job.is_remote || /\bremote\b/i.test(job.location ?? '')) {
    signals.push({ id: 'remote', label: 'Remote' });
  }
  for (const rule of SIGNAL_RULES) {
    if (rule.pattern.test(haystack) && !signals.some((signal) => signal.id === rule.id)) {
      signals.push({ id: rule.id, label: rule.label });
    }
  }
  return signals.slice(0, 4);
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
