'use client';

import { AlertCircle, BarChart3, CalendarCheck, Target } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { buildCampaignSummary, type CampaignJob } from '@/lib/application-campaign';

interface ApplicationCampaignTrackerProps {
  jobs: CampaignJob[];
  onOpenDetails: (jobId: string) => void;
}

const funnelLabels: Array<{ key: CampaignJob['status']; label: string }> = [
  { key: 'draft', label: 'Draft' },
  { key: 'tailored', label: 'Tailored' },
  { key: 'applied', label: 'Applied' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
];

function actionToneClass(tone: 'urgent' | 'focus' | 'normal'): string {
  if (tone === 'urgent') return 'border-destructive/20 bg-destructive/10 text-destructive';
  if (tone === 'focus')
    return 'border-[var(--primary)]/20 bg-[var(--primary)]/10 text-[var(--primary)]';
  return 'border-[var(--border)] bg-muted/40 text-[var(--muted-foreground)]';
}

export function ApplicationCampaignTracker({
  jobs,
  onOpenDetails,
}: ApplicationCampaignTrackerProps) {
  const summary = useMemo(() => buildCampaignSummary(jobs), [jobs]);

  if (jobs.length === 0) return null;

  return (
    <section className="mb-12 rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--primary)]">
            <Target className="h-3.5 w-3.5" />
            Campaign tracker
          </div>
          <h2 className="text-2xl font-bold">Application campaign</h2>
          <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)] opacity-70">
            Weekly output, response rate, follow-ups, and stale opportunities in one view.
          </p>
        </div>
        <div className="min-w-52">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--muted-foreground)]">
            <span>This week</span>
            <span>
              {summary.appliedThisWeek}/{summary.weeklyTarget}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{ width: `${summary.weeklyProgressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { icon: BarChart3, label: 'Response rate', value: `${summary.responseRatePct}%` },
              { icon: CalendarCheck, label: 'Active pipeline', value: summary.activePipeline },
              { icon: AlertCircle, label: 'Follow-ups due', value: summary.followUpsDue },
              { icon: Target, label: 'Stale drafts', value: summary.staleDrafts },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4"
              >
                <item.icon className="mb-3 h-4 w-4 text-[var(--muted-foreground)]" />
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] opacity-70">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-black">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[var(--border)]/60 p-4">
            <div className="mb-4 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              Funnel
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {funnelLabels.map((item) => {
                const count = summary.statusCounts[item.key] ?? 0;
                const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <div key={item.key} className="rounded-lg bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-bold">{item.label}</span>
                      <span className="text-[var(--muted-foreground)]">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)]/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              Next actions
            </p>
            <Link
              href="/cover-letter"
              className="text-xs font-bold text-[var(--primary)] hover:underline"
            >
              Outreach
            </Link>
          </div>
          {summary.nextActions.length === 0 ? (
            <p className="rounded-lg bg-muted/30 p-4 text-sm text-[var(--muted-foreground)]">
              No overdue follow-ups or stale drafts. Keep adding high-signal roles.
            </p>
          ) : (
            <div className="space-y-2">
              {summary.nextActions.map((action) => (
                <div
                  key={`${action.jobId}-${action.label}`}
                  className={`rounded-lg border px-3 py-2 ${actionToneClass(action.tone)}`}
                >
                  <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest">
                    <span>{action.label}</span>
                    {action.timing && <span className="shrink-0 opacity-80">{action.timing}</span>}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium">{action.detail}</div>
                  {action.contact && (
                    <div className="mt-1 truncate text-xs opacity-80">
                      Contact: {action.contact}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(action.jobId)}
                      className="rounded-md border border-current/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
                    >
                      Details
                    </button>
                    <a
                      href={action.recruiterSearchUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-md border border-current/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
                    >
                      Find recruiter
                    </a>
                    <a
                      href={action.hiringManagerSearchUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-md border border-current/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest transition-opacity hover:opacity-80"
                    >
                      Find hiring manager
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
