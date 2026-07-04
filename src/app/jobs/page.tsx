import type { Metadata } from 'next';
import { Building2, Clock3, ExternalLink, MapPin } from 'lucide-react';

import { JobBrowser } from '@/components/job-browser';
import { listObservedJobFeed } from '@/lib/actions/job-discovery-actions';
import { listResumes } from '@/lib/actions/resume-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse Jobs',
  description:
    'Search live job matches, shortlist roles, and queue applications for reviewed RolePatch apply-agent preparation.',
};

function formatFirstSeen(createdAt: number): string {
  if (!Number.isFinite(createdAt) || createdAt <= 0) return 'First seen unknown';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(createdAt * 1000));
}

export default async function JobsPage() {
  const [resumes, observedJobs] = await Promise.all([listResumes(), listObservedJobFeed(100)]);
  const observedCompanies = new Set(observedJobs.map((job) => job.company).filter(Boolean)).size;
  const observedSources = new Set(observedJobs.map((job) => job.source).filter(Boolean)).size;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Job browser
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">
            Find roles and queue reviewed applications.
          </h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Search live openings, save promising matches, and send jobs into packet prep before any
            guarded fill or submit step.
          </p>
        </div>
        {observedJobs.length > 0 && (
          <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)]/70 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                  Live observed jobs
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  Latest roles from the hourly sync
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Shown', observedJobs.length],
                  ['Companies', observedCompanies],
                  ['Sources', observedSources],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-20 rounded-xl border border-[var(--border)] bg-muted/30 px-3 py-2"
                  >
                    <p className="text-lg font-black text-foreground">{value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {observedJobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-xl border border-[var(--border)]/70 bg-background/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-foreground">{job.title}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{job.company ?? 'Unknown company'}</span>
                      </p>
                    </div>
                    {job.source && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                        {job.source}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted-foreground)]">
                    {job.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatFirstSeen(job.created_at)} UTC
                    </span>
                  </div>
                  {job.job_url && (
                    <a
                      href={job.job_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View role
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        <JobBrowser serverResumes={resumes} />
      </div>
    </main>
  );
}
