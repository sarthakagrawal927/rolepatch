'use client';

import {
  Bell,
  Bookmark,
  Building2,
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
import { createJobApplication } from '@/lib/actions/job-actions';
import {
  addSavedJobShortlist,
  createSavedJobSearch,
  deleteSavedJobSearch,
  listJobDiscoveryAlerts,
  listSavedJobSearches,
  listSavedJobShortlist,
  markJobDiscoveryAlertsSeen,
  recordSavedSearchRun,
  removeSavedJobShortlist,
  updateSavedJobSearch,
} from '@/lib/actions/job-discovery-actions';
import { diffNewJobs, isDuplicateJob, rankDiscoveredJobs } from '@/lib/job-discovery-alerts';
import type { DiscoveredJob } from '@/lib/job-discovery-types';
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
  localUpdateSavedJobSearch,
} from '@/lib/local-storage';

interface JobDiscoveryProps {
  resumes: { id: string; name: string }[];
}

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

export function JobDiscovery({ resumes }: JobDiscoveryProps) {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [remote, setRemote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<DiscoveredJob[]>([]);
  const [tailoringId, setTailoringId] = useState<string | null>(null);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState<
    Array<{ id: string; name: string; query: string; paused: boolean | number }>
  >([]);
  const [shortlist, setShortlist] = useState<
    Array<{ id: string; title: string; company: string; job_url: string }>
  >([]);
  const [alerts, setAlerts] = useState<
    Array<{ id: string; title: string; detail: string; seen: boolean | number }>
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
      setSavedSearches(searches);
      setShortlist(savedJobs);
      setAlerts(alertRows.map((row) => ({ ...row, seen: row.seen === 1 })));
    }
    void hydrate();
  }, [isGuest]);

  const shortlistUrls = useMemo(() => shortlist.map((item) => item.job_url), [shortlist]);
  const unseenAlerts = alerts.filter((alert) => !alert.seen).length;

  async function runSearch(searchQuery = query, searchLocation = location, searchRemote = remote) {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);

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
    if (!job.job_url || !resumes.length) return;
    setTailoringId(job.id);
    try {
      const jobId = await createJobApplication(
        resumes[0].id,
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

  if (isGuest) {
    return (
      <div className="border border-dashed border-[var(--border)] rounded-2xl py-12 px-6 text-center bg-muted/10">
        <Sparkles className="w-6 h-6 mx-auto text-[var(--muted-foreground)]/40 mb-3" />
        <p className="text-sm font-bold text-foreground">Sign in to discover jobs</p>
        <p className="text-xs font-medium text-[var(--muted-foreground)] mt-1">
          Pulls live openings from Indeed, LinkedIn, Google, Glassdoor, and ZipRecruiter.
        </p>
      </div>
    );
  }

  const needsResume = resumes.length === 0;

  return (
    <div className="space-y-6">
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

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((job) => {
            const salary = formatSalary(job.min_amount, job.max_amount, job.currency);
            const saved = job.job_url ? isDuplicateJob(job.job_url, shortlistUrls) : false;
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

                {job.description_short && (
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-3 opacity-80">
                    {job.description_short}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto pt-2">
                  <button
                    onClick={() => handleTailor(job)}
                    disabled={needsResume || tailoringId === job.id}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-40 transition-opacity"
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
