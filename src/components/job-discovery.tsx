'use client';

import {
  Bell,
  Bookmark,
  Building2,
  ClipboardCheck,
  DollarSign,
  ExternalLink,
  MapPin,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { queueApplication } from '@/lib/actions/apply-agent-actions';
import { createJobApplication } from '@/lib/actions/job-actions';
import {
  addSavedJobShortlist,
  createCompanyWatch,
  createSavedJobSearch,
  deleteCompanyWatch,
  deleteSavedJobSearch,
  listCompanyWatches,
  listJobDiscoveryAlerts,
  listSavedJobSearches,
  listSavedJobShortlist,
  markJobDiscoveryAlertsSeen,
  recordSavedSearchRun,
  removeSavedJobShortlist,
  runCompanyWatch,
  updateCompanyWatch,
  updateSavedJobSearch,
} from '@/lib/actions/job-discovery-actions';
import { rankDiscoveredJobsByResumeSimilarity } from '@/lib/actions/job-discovery-similarity-actions';
import {
  buildDiscoveryEngagementSummary,
  diffNewJobs,
  inferJobSignals,
  isDuplicateJob,
  normalizeJobUrl,
  rankDiscoveredJobs,
} from '@/lib/job-discovery-alerts';
import type { JobDiscoveryAlert, JobSignal } from '@/lib/job-discovery-alerts';
import type { DiscoveredJob } from '@/lib/job-discovery-types';
import type { CompanyWatch } from '@/lib/types';
import {
  localAddJobDiscoveryAlert,
  localAddSavedJobShortlist,
  localCreateSavedJobSearch,
  localDeleteSavedJobSearch,
  localListJobDiscoveryAlerts,
  localListSavedJobSearches,
  localListSavedJobShortlist,
  localMarkJobDiscoveryAlertsSeen,
  localRemoveSavedJobShortlist,
  localQueueApplication,
  localSaveJob,
  localUpdateSavedJobSearch,
} from '@/lib/local-storage';

interface JobDiscoveryProps {
  resumes: { id: string; name: string; source?: string }[];
  onQueueDiscoveredJob?: (
    job: DiscoveredJob,
    resumeId: string,
    context?: DiscoveryQueueContext
  ) => Promise<void>;
}

export interface DiscoveryQueueContext {
  semanticScore?: number;
  matchTerms?: string[];
}

const SEMANTIC_RANK_MESSAGES = {
  sign_in_required: 'Sign in to rank jobs by resume similarity.',
  resume_missing: 'Select a resume with source text before ranking jobs.',
  knowledgebase_unconfigured: 'Knowledgebase similarity is not configured yet.',
  no_descriptions: 'No job descriptions are available for semantic ranking.',
  no_matches: 'Knowledgebase did not return semantic matches; keeping the current order.',
  service_unavailable: 'Knowledgebase similarity is temporarily unavailable.',
} as const;

const SEMANTIC_SCORE_FILTERS = [
  { label: '90%+', value: 90 },
  { label: '80%+', value: 80 },
  { label: '70%+', value: 70 },
] as const;
const STRONG_MATCH_QUEUE_THRESHOLD = 80;

const QUICK_SEARCHES = [
  { label: 'Remote AI engineer', query: 'AI engineer', location: 'Remote', remote: true },
  {
    label: 'Product engineer',
    query: 'product engineer',
    location: 'United States',
    remote: false,
  },
  { label: 'New grad software', query: 'new grad software engineer', location: '', remote: false },
  {
    label: 'Visa-friendly roles',
    query: 'visa sponsorship software engineer',
    location: '',
    remote: false,
  },
] as const;

function formatSalary(
  min?: number | null,
  max?: number | null,
  currency?: string | null
): string | null {
  if (min == null && max == null) return null;
  const cur = currency ?? 'USD';
  const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (min != null && max != null) return `${cur} ${fmt(min)}–${fmt(max)}`;
  if (min != null) return `${cur} ${fmt(min)}+`;
  return `${cur} up to ${fmt(max!)}`;
}

function sourceLabel(source: string | null): string {
  switch (source) {
    case 'greenhouse':
      return 'Greenhouse';
    case 'lever':
      return 'Lever';
    case 'ashby':
      return 'Ashby';
    case 'workable':
      return 'Workable';
    case 'recruitee':
      return 'Recruitee';
    case 'personio':
      return 'Personio';
    case 'smartrecruiters':
      return 'SmartRecruiters';
    case 'career_page':
      return 'Career page';
    case 'linkedin_fallback':
      return 'LinkedIn fallback';
    case 'linkedin':
      return 'LinkedIn';
    default:
      return 'Not checked';
  }
}

export function JobDiscovery({ resumes, onQueueDiscoveredJob }: JobDiscoveryProps) {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<DiscoveredJob[]>([]);
  const [tailoringId, setTailoringId] = useState<string | null>(null);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [batchQueueing, setBatchQueueing] = useState(false);
  const [queueSummary, setQueueSummary] = useState('');
  const [semanticRanking, setSemanticRanking] = useState(false);
  const [semanticSummary, setSemanticSummary] = useState('');
  const [semanticScores, setSemanticScores] = useState<Record<string, number>>({});
  const [semanticMatchTermsById, setSemanticMatchTermsById] = useState<Record<string, string[]>>(
    {}
  );
  const [semanticScoreFilter, setSemanticScoreFilter] = useState<number | null>(null);
  const [queuedDiscoveryIds, setQueuedDiscoveryIds] = useState<Set<string>>(() => new Set());
  const [activeSignalFilters, setActiveSignalFilters] = useState<Set<JobSignal['id']>>(
    () => new Set()
  );
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id ?? '');
  const [saveSearchName, setSaveSearchName] = useState('');
  const [watchCompany, setWatchCompany] = useState('');
  const [watchRoleQuery, setWatchRoleQuery] = useState('');
  const [watchCareerUrl, setWatchCareerUrl] = useState('');
  const [watchLocation, setWatchLocation] = useState('');
  const [watchRemote, setWatchRemote] = useState(false);
  const [checkingWatchId, setCheckingWatchId] = useState<string | null>(null);
  const [companyWatches, setCompanyWatches] = useState<CompanyWatch[]>([]);
  const [savedSearches, setSavedSearches] = useState<
    Array<{ id: string; name: string; query: string; paused: boolean | number }>
  >([]);
  const [shortlist, setShortlist] = useState<
    Array<{ id: string; title: string; company: string; job_url: string }>
  >([]);
  const [alerts, setAlerts] = useState<
    Array<
      Pick<
        JobDiscoveryAlert,
        | 'id'
        | 'title'
        | 'detail'
        | 'external_job_id'
        | 'company'
        | 'job_url'
        | 'location'
        | 'source'
      > & { seen: boolean | number }
    >
  >([]);

  useEffect(() => {
    async function hydrate() {
      if (isGuest) {
        setSavedSearches(localListSavedJobSearches());
        setShortlist(localListSavedJobShortlist());
        setAlerts(localListJobDiscoveryAlerts());
        return;
      }
      const [searches, savedJobs, alertRows] = await Promise.all([
        listSavedJobSearches(),
        listSavedJobShortlist(),
        listJobDiscoveryAlerts(),
      ]);
      const watches = await listCompanyWatches();
      setSavedSearches(searches);
      setShortlist(savedJobs);
      setAlerts(alertRows.map((row) => ({ ...row, seen: row.seen === 1 })));
      setCompanyWatches(watches);
    }
    void hydrate();
  }, [isGuest]);

  useEffect(() => {
    if (!selectedResumeId && resumes[0]) setSelectedResumeId(resumes[0].id);
  }, [resumes, selectedResumeId]);

  const shortlistUrls = useMemo(() => shortlist.map((item) => item.job_url), [shortlist]);
  const availableSignalFilters = useMemo(() => {
    const signalsById = new Map<JobSignal['id'], JobSignal>();
    for (const job of results) {
      for (const signal of inferJobSignals(job)) {
        if (!signalsById.has(signal.id)) signalsById.set(signal.id, signal);
      }
    }
    return [...signalsById.values()];
  }, [results]);
  const hasSemanticScores = Object.keys(semanticScores).length > 0;
  const visibleResults = useMemo(() => {
    return results.filter((job) => {
      if (semanticScoreFilter != null && (semanticScores[job.id] ?? 0) < semanticScoreFilter) {
        return false;
      }
      if (activeSignalFilters.size === 0) return true;
      const jobSignalIds = new Set(inferJobSignals(job).map((signal) => signal.id));
      return [...activeSignalFilters].every((id) => jobSignalIds.has(id));
    });
  }, [activeSignalFilters, results, semanticScoreFilter, semanticScores]);
  const queueableResults = useMemo(() => {
    const seenUrls = new Set<string>();
    return visibleResults.filter((job) => {
      if (!job.job_url || queuedDiscoveryIds.has(job.id)) return false;
      const normalizedUrl = normalizeJobUrl(job.job_url);
      if (seenUrls.has(normalizedUrl)) return false;
      seenUrls.add(normalizedUrl);
      return true;
    });
  }, [queuedDiscoveryIds, visibleResults]);
  const strongMatchQueueableResults = useMemo(() => {
    const seenUrls = new Set<string>();
    return results.filter((job) => {
      if ((semanticScores[job.id] ?? 0) < STRONG_MATCH_QUEUE_THRESHOLD) return false;
      if (!job.job_url || queuedDiscoveryIds.has(job.id)) return false;
      const normalizedUrl = normalizeJobUrl(job.job_url);
      if (seenUrls.has(normalizedUrl)) return false;
      seenUrls.add(normalizedUrl);
      return true;
    });
  }, [queuedDiscoveryIds, results, semanticScores]);
  const unseenAlerts = alerts.filter((alert) => !alert.seen).length;
  const discoverySummary = useMemo(
    () =>
      buildDiscoveryEngagementSummary({
        savedSearches,
        companyWatches,
        shortlist,
        alerts,
      }),
    [alerts, companyWatches, savedSearches, shortlist]
  );

  async function runSearch(searchQuery = query, searchLocation = location, searchRemote = remote) {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setQueueSummary('');
    setSemanticSummary('');
    setSemanticScores({});
    setSemanticMatchTermsById({});
    setSemanticScoreFilter(null);
    setResults([]);
    setActiveSignalFilters(new Set());

    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery.trim(),
          location: searchLocation.trim() || undefined,
          remote: searchRemote || undefined,
          results_wanted: 25,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        let msg = `Search failed (${res.status})`;
        try {
          const json = JSON.parse(body);
          msg = json.error ?? json.detail ?? msg;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as { jobs?: DiscoveredJob[] };
      const ranked = rankDiscoveredJobs(data.jobs ?? [], searchQuery);
      setResults(ranked);
      return ranked;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch();
  }

  function toggleSignalFilter(id: JobSignal['id']) {
    setActiveSignalFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleQuickSearch(search: (typeof QUICK_SEARCHES)[number]) {
    setQuery(search.query);
    setLocation(search.location);
    setRemote(search.remote);
    await runSearch(search.query, search.location, search.remote);
  }

  async function handleSaveSearch() {
    if (!saveSearchName.trim() || !query.trim()) return;
    if (isGuest) {
      localCreateSavedJobSearch({
        name: saveSearchName.trim(),
        query: query.trim(),
        location,
        remote,
      });
      setSavedSearches(localListSavedJobSearches());
    } else {
      await createSavedJobSearch({
        name: saveSearchName.trim(),
        query: query.trim(),
        location,
        remote,
      });
      setSavedSearches(await listSavedJobSearches());
    }
    setSaveSearchName('');
  }

  async function handleSaveCompanyWatch() {
    if (!watchCompany.trim()) return;
    if (isGuest) {
      setError('Sign in to save company watches and run daily career-page checks.');
      return;
    }
    await createCompanyWatch({
      company: watchCompany.trim(),
      careerUrl: watchCareerUrl.trim() || undefined,
      roleQuery: watchRoleQuery.trim() || undefined,
      location: watchLocation.trim() || undefined,
      remote: watchRemote,
    });
    setWatchCompany('');
    setWatchRoleQuery('');
    setWatchCareerUrl('');
    setCompanyWatches(await listCompanyWatches());
  }

  async function handleRunCompanyWatch(watch: CompanyWatch) {
    if (isGuest) {
      setError('Sign in to run company watches.');
      return;
    }
    setCheckingWatchId(watch.id);
    setQuery([watch.company, watch.role_query].filter(Boolean).join(' '));
    setLocation(watch.location);
    setRemote(watch.remote);
    try {
      await runCompanyWatch(watch.id);
      const [watches, alertRows] = await Promise.all([
        listCompanyWatches(),
        listJobDiscoveryAlerts(),
      ]);
      setCompanyWatches(watches);
      setAlerts(alertRows.map((row) => ({ ...row, seen: row.seen === 1 })));
    } finally {
      setCheckingWatchId(null);
    }
  }

  async function handleRunSavedSearch(search: {
    id: string;
    query: string;
    location?: string;
    remote?: boolean | number;
  }) {
    setQuery(search.query);
    setLocation(typeof search.location === 'string' ? search.location : '');
    setRemote(Boolean(search.remote));
    const jobs = await runSearch(
      search.query,
      typeof search.location === 'string' ? search.location : '',
      Boolean(search.remote)
    );
    if (!jobs?.length) return;

    if (isGuest) {
      const previous = localListSavedJobSearches().find((item) => item.id === search.id);
      const previousIds = previous?.last_run_at ? jobs.map((job) => job.id) : [];
      const newJobs = diffNewJobs(jobs, previousIds);
      for (const job of newJobs.slice(0, 5)) {
        localAddJobDiscoveryAlert({
          type: 'new_match',
          title: job.title ?? 'New job match',
          detail: `${job.company ?? 'Company'} · ${job.location ?? 'Location unknown'}`,
          external_job_id: job.id,
          company: job.company ?? null,
          job_url: job.job_url ?? null,
          location: job.location ?? null,
          source: job.site ?? 'saved_search',
        });
      }
      setAlerts(localListJobDiscoveryAlerts());
    } else {
      await recordSavedSearchRun(search.id, jobs);
      setAlerts((await listJobDiscoveryAlerts()).map((row) => ({ ...row, seen: row.seen === 1 })));
    }
  }

  async function handleShortlist(job: DiscoveredJob) {
    if (!job.job_url || isDuplicateJob(job.job_url, shortlistUrls)) return;
    if (isGuest) {
      localAddSavedJobShortlist(job);
      setShortlist(localListSavedJobShortlist());
      return;
    }
    await addSavedJobShortlist(job);
    setShortlist(await listSavedJobShortlist());
  }

  async function handleTailor(job: DiscoveredJob) {
    if (!job.job_url || !selectedResumeId) return;
    setTailoringId(job.id);
    try {
      if (isGuest) {
        const jobId = crypto.randomUUID();
        localSaveJob(
          jobId,
          job.company ?? 'Unknown Company',
          job.title ?? 'Untitled Role',
          selectedResumeId,
          job.job_url,
          job.description ?? job.description_short ?? '',
          job.description ?? job.description_short ?? ''
        );
        router.push(`/tailor/${jobId}`);
        return;
      }
      const jobId = await createJobApplication(
        selectedResumeId,
        job.job_url,
        job.company ?? 'Unknown Company',
        job.title ?? 'Untitled Role',
        job.description ?? job.description_short ?? '',
        job.description ?? job.description_short ?? ''
      );
      router.push(`/tailor/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job');
      setTailoringId(null);
    }
  }

  async function queueDiscoveredJob(job: DiscoveredJob) {
    if (!job.job_url || !selectedResumeId) return;
    if (onQueueDiscoveredJob) {
      const semanticScore = semanticScores[job.id];
      const matchTerms = semanticMatchTermsById[job.id];
      const context =
        semanticScore != null || matchTerms?.length ? { semanticScore, matchTerms } : undefined;
      if (context) {
        await onQueueDiscoveredJob(job, selectedResumeId, context);
      } else {
        await onQueueDiscoveredJob(job, selectedResumeId);
      }
      return;
    }
    if (isGuest) {
      const jobId = crypto.randomUUID();
      localSaveJob(
        jobId,
        job.company ?? 'Unknown Company',
        job.title ?? 'Untitled Role',
        selectedResumeId,
        job.job_url,
        job.description ?? job.description_short ?? '',
        job.description ?? job.description_short ?? ''
      );
      localQueueApplication(jobId);
      return;
    }
    const jobId = await createJobApplication(
      selectedResumeId,
      job.job_url,
      job.company ?? 'Unknown Company',
      job.title ?? 'Untitled Role',
      job.description ?? job.description_short ?? '',
      job.description ?? job.description_short ?? ''
    );
    await queueApplication(jobId);
  }

  function idsForNormalizedJobUrls(urls: Set<string>): string[] {
    return results
      .filter((job) => job.job_url && urls.has(normalizeJobUrl(job.job_url)))
      .map((job) => job.id);
  }

  async function handleQueueForReview(job: DiscoveredJob) {
    if (!job.job_url || !selectedResumeId || queuedDiscoveryIds.has(job.id)) return;
    setQueueingId(job.id);
    setError('');
    setQueueSummary('');
    try {
      await queueDiscoveredJob(job);
      const queuedUrl = new Set([normalizeJobUrl(job.job_url)]);
      setQueuedDiscoveryIds((prev) => {
        const next = new Set(prev);
        for (const id of idsForNormalizedJobUrls(queuedUrl)) next.add(id);
        return next;
      });
      setQueueSummary('Queued 1 job for reviewed apply prep.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue job for review');
    } finally {
      setQueueingId(null);
    }
  }

  async function queueDiscoveredJobBatch(
    jobs: DiscoveredJob[],
    successMessage: (count: number) => string
  ) {
    if (!selectedResumeId || jobs.length === 0) return;
    setBatchQueueing(true);
    setError('');
    setQueueSummary('');
    const queuedIds: string[] = [];
    const queuedUrls = new Set<string>();
    const failures: string[] = [];
    for (const job of jobs) {
      try {
        await queueDiscoveredJob(job);
        queuedIds.push(job.id);
        if (job.job_url) queuedUrls.add(normalizeJobUrl(job.job_url));
      } catch {
        failures.push(job.title ?? job.id);
      }
    }
    if (queuedIds.length > 0) {
      setQueuedDiscoveryIds((prev) => {
        const next = new Set(prev);
        for (const id of idsForNormalizedJobUrls(queuedUrls)) next.add(id);
        return next;
      });
    }
    if (failures.length > 0) {
      setError(
        `${failures.length} job${failures.length === 1 ? '' : 's'} could not be queued for review.`
      );
    }
    if (queuedIds.length > 0) {
      setQueueSummary(successMessage(queuedIds.length));
    }
    setBatchQueueing(false);
  }

  async function handleQueueVisibleResults() {
    await queueDiscoveredJobBatch(
      queueableResults,
      (count) => `Queued ${count} job${count === 1 ? '' : 's'} for reviewed apply prep.`
    );
  }

  async function handleQueueStrongMatches() {
    await queueDiscoveredJobBatch(
      strongMatchQueueableResults,
      (count) =>
        `Queued ${count} strong resume match${count === 1 ? '' : 'es'} for reviewed apply prep.`
    );
  }

  async function handleRankByResumeMatch() {
    if (!selectedResumeId || results.length === 0) return;
    setSemanticRanking(true);
    setError('');
    setQueueSummary('');
    setSemanticSummary('');
    try {
      const result = await rankDiscoveredJobsByResumeSimilarity(selectedResumeId, results);
      if (result.status === 'ranked') {
        setResults((prev) => {
          const byId = new Map(prev.map((job) => [job.id, job]));
          const ranked = result.orderedIds
            .map((id) => byId.get(id))
            .filter((job): job is DiscoveredJob => Boolean(job));
          const rankedIds = new Set(ranked.map((job) => job.id));
          return [...ranked, ...prev.filter((job) => !rankedIds.has(job.id))];
        });
        setSemanticScores(result.scoresById);
        setSemanticMatchTermsById(result.matchTermsById);
        setSemanticScoreFilter(null);
        setSemanticSummary(
          `Ranked ${result.rankedCount} match${result.rankedCount === 1 ? '' : 'es'} by resume similarity.`
        );
      } else {
        setSemanticScores({});
        setSemanticMatchTermsById({});
        setSemanticScoreFilter(null);
        setSemanticSummary(SEMANTIC_RANK_MESSAGES[result.reason]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rank jobs by resume similarity');
    } finally {
      setSemanticRanking(false);
    }
  }

  const needsResume = resumes.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Active searches
          </p>
          <p className="mt-2 text-2xl font-bold">
            {discoverySummary.activeSavedSearches + discoverySummary.activeCompanyWatches}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {discoverySummary.savedSearches} saved · {discoverySummary.companyWatches} companies
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            New alerts
          </p>
          <p className="mt-2 text-2xl font-bold">{discoverySummary.unseenAlerts}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {discoverySummary.alerts} recent matches tracked
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Watch yield
          </p>
          <p className="mt-2 text-2xl font-bold">{discoverySummary.watchedRolesFound}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            roles found in latest company checks
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Source health
          </p>
          <p className="mt-2 text-sm font-bold">{discoverySummary.sourceDecision.label}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {discoverySummary.latestSource
              ? `${sourceLabel(discoverySummary.latestSource)} · `
              : ''}
            {discoverySummary.sourceDecision.detail}
          </p>
        </div>
      </div>

      {(unseenAlerts > 0 || alerts.length > 0) && (
        <div className="rounded-2xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
              <Bell className="h-4 w-4" />
              Job alerts {unseenAlerts > 0 ? `(${unseenAlerts} new)` : ''}
            </div>
            <button
              type="button"
              onClick={async () => {
                if (isGuest) localMarkJobDiscoveryAlertsSeen();
                else await markJobDiscoveryAlertsSeen();
                setAlerts((prev) => prev.map((alert) => ({ ...alert, seen: true })));
              }}
              className="text-xs font-medium text-[var(--primary)] hover:underline"
            >
              Mark seen
            </button>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="text-xs text-[var(--muted-foreground)]">
                <span className="font-semibold text-foreground">{alert.title}</span> ·{' '}
                {alert.detail}
              </div>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSearch}
        className="bg-[var(--card)] border border-[var(--border)]/60 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_auto_auto] gap-3 items-end"
      >
        <div>
          <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1.5">
            What
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="python engineer, staff PM, ..."
            className="input-base"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-1.5">
            Where (optional)
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="San Francisco, Remote, ..."
            className="input-base"
          />
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remote}
            onChange={(e) => setRemote(e.target.checked)}
            className="accent-[var(--primary)]"
          />
          Remote
        </label>
        <button
          type="submit"
          disabled={loading || !query.trim() || needsResume}
          className="px-5 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
        >
          {loading ? 'Searching…' : 'Discover jobs'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
          Quick searches
        </span>
        {QUICK_SEARCHES.map((search) => (
          <button
            key={search.label}
            type="button"
            onClick={() => handleQuickSearch(search)}
            disabled={loading || needsResume}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            {search.label}
          </button>
        ))}
      </div>

      {resumes.length > 1 && (
        <label className="block max-w-sm">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Base Profile
          </span>
          <select
            value={selectedResumeId}
            onChange={(event) => setSelectedResumeId(event.target.value)}
            className="input-base"
          >
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {query.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={saveSearchName}
            onChange={(event) => setSaveSearchName(event.target.value)}
            placeholder="Name this search"
            className="input-base max-w-xs"
          />
          <button
            type="button"
            onClick={handleSaveSearch}
            disabled={!saveSearchName.trim()}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-muted"
          >
            Save search alert
          </button>
        </div>
      )}

      {savedSearches.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)]/60 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Saved searches
          </p>
          {savedSearches.map((search) => (
            <div key={search.id} className="flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => handleRunSavedSearch(search)}
                className="font-medium text-foreground hover:text-[var(--primary)]"
              >
                {search.name}
              </button>
              <span className="text-xs text-[var(--muted-foreground)]">{search.query}</span>
              <button
                type="button"
                onClick={async () => {
                  if (isGuest) {
                    localUpdateSavedJobSearch(search.id, !search.paused);
                    setSavedSearches(localListSavedJobSearches());
                  } else {
                    await updateSavedJobSearch(search.id, !search.paused);
                    setSavedSearches(await listSavedJobSearches());
                  }
                }}
                className="text-xs text-[var(--muted-foreground)] hover:text-foreground"
              >
                {search.paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isGuest) {
                    localDeleteSavedJobSearch(search.id);
                    setSavedSearches(localListSavedJobSearches());
                  } else {
                    await deleteSavedJobSearch(search.id);
                    setSavedSearches(await listSavedJobSearches());
                  }
                }}
                className="ml-auto text-[var(--muted-foreground)] hover:text-destructive"
                aria-label="Delete saved search"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isGuest ? (
        <div className="rounded-2xl border border-[var(--border)]/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              Company watches
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {companyWatches.length}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <input
              value={watchCompany}
              onChange={(event) => setWatchCompany(event.target.value)}
              placeholder="Company"
              className="input-base"
            />
            <input
              value={watchRoleQuery}
              onChange={(event) => setWatchRoleQuery(event.target.value)}
              placeholder="Role keywords"
              className="input-base"
            />
            <input
              value={watchLocation}
              onChange={(event) => setWatchLocation(event.target.value)}
              placeholder="Location"
              className="input-base"
            />
            <input
              value={watchCareerUrl}
              onChange={(event) => setWatchCareerUrl(event.target.value)}
              placeholder="Career URL: ATS board or custom page"
              className="input-base"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={watchRemote}
                onChange={(event) => setWatchRemote(event.target.checked)}
                className="accent-[var(--primary)]"
              />
              Remote
            </label>
            <button
              type="button"
              onClick={handleSaveCompanyWatch}
              disabled={!watchCompany.trim()}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-muted disabled:opacity-40"
            >
              Save company watch
            </button>
          </div>
          {companyWatches.length > 0 && (
            <div className="mt-4 space-y-2">
              {companyWatches.slice(0, 6).map((watch) => (
                <div
                  key={watch.id}
                  className="rounded-lg border border-[var(--border)]/50 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => handleRunCompanyWatch(watch)}
                      className="font-medium text-foreground hover:text-[var(--primary)]"
                    >
                      {watch.company}
                    </button>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {watch.role_query || 'Any role'}
                      {watch.location ? ` · ${watch.location}` : ''}
                      {watch.remote ? ' · Remote' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateCompanyWatch(watch.id, !watch.paused);
                        setCompanyWatches(await listCompanyWatches());
                      }}
                      className="text-xs text-[var(--muted-foreground)] hover:text-foreground"
                    >
                      {watch.paused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunCompanyWatch(watch)}
                      disabled={checkingWatchId === watch.id}
                      className="text-xs text-[var(--primary)] hover:underline disabled:opacity-40"
                    >
                      {checkingWatchId === watch.id ? 'Checking...' : 'Check now'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteCompanyWatch(watch.id);
                        setCompanyWatches(await listCompanyWatches());
                      }}
                      className="ml-auto text-[var(--muted-foreground)] hover:text-destructive"
                      aria-label="Delete company watch"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    <span>
                      Last: {sourceLabel(watch.last_source)} · {watch.last_found_count ?? 0} roles
                    </span>
                    {watch.last_error && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-600">
                        Fallback: {watch.last_error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border)]/70 bg-muted/10 p-4">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            Daily company watches require sign in
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Guests can search live jobs, save local shortlists, and tailor drafts. Sign in to run
            recurring career-page checks and synced alerts.
          </p>
        </div>
      )}

      {shortlist.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)]/60 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Shortlist
          </p>
          {shortlist.slice(0, 8).map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <Bookmark className="h-4 w-4 text-[var(--primary)]" />
              <span className="font-medium truncate">{item.title}</span>
              <span className="text-xs text-[var(--muted-foreground)] truncate">
                {item.company}
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (isGuest) {
                    localRemoveSavedJobShortlist(item.id);
                    setShortlist(localListSavedJobShortlist());
                  } else {
                    await removeSavedJobShortlist(item.id);
                    setShortlist(await listSavedJobShortlist());
                  }
                }}
                className="ml-auto text-[var(--muted-foreground)] hover:text-destructive"
                aria-label="Remove from shortlist"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {needsResume && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Create a resume first — tailoring needs a base to work from.
        </p>
      )}

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}
      {queueSummary && (
        <div className="text-sm text-[var(--primary)] bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg px-4 py-2">
          {queueSummary}
        </div>
      )}
      {semanticSummary && (
        <div className="text-sm text-[var(--primary)] bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-lg px-4 py-2">
          {semanticSummary}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-3">
            <div>
              <p className="text-sm font-bold text-foreground">
                {visibleResults.length === results.length
                  ? `${results.length} matches found`
                  : `${visibleResults.length} of ${results.length} matches shown`}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Queue visible matches for packet prep and reviewed apply.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRankByResumeMatch}
                disabled={needsResume || semanticRanking || results.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {semanticRanking ? 'Ranking...' : 'Rank by resume match'}
              </button>
              <button
                type="button"
                onClick={handleQueueVisibleResults}
                disabled={needsResume || batchQueueing || queueableResults.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                {batchQueueing
                  ? 'Queueing...'
                  : queueableResults.length === 0
                    ? 'All visible queued'
                    : `Queue ${queueableResults.length} for review`}
              </button>
            </div>
          </div>
          {availableSignalFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Filter by signal
              </span>
              {availableSignalFilters.map((signal) => {
                const active = activeSignalFilters.has(signal.id);
                return (
                  <button
                    key={signal.id}
                    type="button"
                    onClick={() => toggleSignalFilter(signal.id)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                        : 'border-[var(--border)] bg-muted/30 text-[var(--muted-foreground)] hover:text-foreground'
                    }`}
                  >
                    {signal.label}
                  </button>
                );
              })}
              {activeSignalFilters.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveSignalFilters(new Set())}
                  className="ml-auto text-xs font-medium text-[var(--muted-foreground)] hover:text-foreground"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
          {hasSemanticScores && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Filter by semantic match
              </span>
              {SEMANTIC_SCORE_FILTERS.map((filter) => {
                const active = semanticScoreFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setSemanticScoreFilter(active ? null : filter.value)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                        : 'border-[var(--border)] bg-muted/30 text-[var(--muted-foreground)] hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
              {semanticScoreFilter != null && (
                <button
                  type="button"
                  onClick={() => setSemanticScoreFilter(null)}
                  className="text-xs font-medium text-[var(--muted-foreground)] hover:text-foreground"
                >
                  Clear match filter
                </button>
              )}
              <button
                type="button"
                onClick={handleQueueStrongMatches}
                disabled={needsResume || batchQueueing || strongMatchQueueableResults.length === 0}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                {batchQueueing
                  ? 'Queueing...'
                  : strongMatchQueueableResults.length === 0
                    ? 'Strong matches queued'
                    : `Queue ${strongMatchQueueableResults.length} strong match${strongMatchQueueableResults.length === 1 ? '' : 'es'}`}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleResults.map((job) => {
              const salary = formatSalary(job.min_amount, job.max_amount, job.currency);
              const saved = job.job_url ? isDuplicateJob(job.job_url, shortlistUrls) : false;
              const queued = queuedDiscoveryIds.has(job.id);
              const signals = inferJobSignals(job);
              const semanticScore = semanticScores[job.id];
              const matchTerms = semanticMatchTermsById[job.id] ?? [];
              return (
                <div
                  key={job.id}
                  className="bg-[var(--card)] border border-[var(--border)]/60 rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--primary)]/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-foreground truncate">
                        {job.title ?? 'Untitled role'}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] mt-1">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{job.company ?? 'Unknown company'}</span>
                      </div>
                    </div>
                    {job.site && (
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-muted text-[var(--muted-foreground)]">
                        {job.site}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">
                    {job.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.location}
                        {job.is_remote ? ' · Remote' : ''}
                      </span>
                    )}
                    {salary && (
                      <span className="inline-flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {salary}
                      </span>
                    )}
                    {job.date_posted && <span>Posted {job.date_posted.slice(0, 10)}</span>}
                  </div>

                  {(signals.length > 0 || semanticScore != null) && (
                    <div className="flex flex-wrap gap-1.5">
                      {semanticScore != null && (
                        <span className="rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                          Semantic match {semanticScore}%
                        </span>
                      )}
                      {signals.map((signal) => (
                        <span
                          key={signal.id}
                          className="rounded-full border border-[var(--border)] bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]"
                        >
                          {signal.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {matchTerms.length > 0 && (
                    <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
                      Why matched: {matchTerms.join(', ')}
                    </p>
                  )}

                  {job.description_short && (
                    <p className="text-xs text-[var(--muted-foreground)] line-clamp-3 opacity-80">
                      {job.description_short}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <button
                      type="button"
                      onClick={() => handleQueueForReview(job)}
                      disabled={needsResume || queued || queueingId === job.id || !job.job_url}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      <ClipboardCheck className="h-3 w-3" />
                      {queueingId === job.id
                        ? 'Queueing...'
                        : queued
                          ? 'Queued'
                          : 'Queue for review'}
                    </button>
                    <button
                      onClick={() => handleTailor(job)}
                      disabled={needsResume || tailoringId === job.id}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                      {tailoringId === job.id ? 'Saving…' : 'Tailor this'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShortlist(job)}
                      disabled={saved || !job.job_url}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                    >
                      <Star className="w-3 h-3" />
                      {saved ? 'Saved' : 'Shortlist'}
                    </button>
                    {job.job_url && (
                      <a
                        href={job.job_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results.length === 0 && !loading && !error && (
        <p className="text-xs text-[var(--muted-foreground)] opacity-70">
          Search pulls live openings, then save the query to revisit it and surface new matches
          without manual searching.
        </p>
      )}
    </div>
  );
}
