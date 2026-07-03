'use client';

import {
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { APPLICATION_QUEUE_STATUSES, queueStatusLabel } from '@/lib/apply-agent';
import { failureCodeLabel, getApplyAgentRemediation } from '@/lib/apply-agent-remediation';
import type {
  ApplicationPacket,
  ApplicationQueueEntry,
  ApplicationQueueStatus,
  ApplicationReceipt,
  ApplyAgentDiscoveryAlert,
  ApplyAgentFailureCode,
  JobApplication,
  ProfileAnswer,
  ProfileAnswerCategory,
} from '@/lib/types';

type ApplyAgentJob = Pick<
  JobApplication,
  'id' | 'resume_id' | 'url' | 'company' | 'role' | 'status' | 'updated_at'
>;

type QueueFilter = 'all' | 'ready' | 'needs_user' | 'failed' | 'skipped';

interface ApplyAgentCommandCenterProps {
  jobs: ApplyAgentJob[];
  resumeCount: number;
  fitScores: Record<string, number>;
  queue: ApplicationQueueEntry[];
  receipts: ApplicationReceipt[];
  packets: ApplicationPacket[];
  profileAnswers: ProfileAnswer[];
  discoveryAlerts: ApplyAgentDiscoveryAlert[];
  onQueueApplication: (jobId: string) => Promise<void>;
  onQueueDiscoveryAlert: (alert: ApplyAgentDiscoveryAlert) => Promise<void>;
  onQueueReadyApplications: () => Promise<void>;
  onRefreshReadiness: () => Promise<void>;
  onUpdateQueueStatus: (queueId: string, status: ApplicationQueueStatus) => Promise<void>;
  onBulkUpdateQueueStatus: (
    queueIds: string[],
    status: Exclude<ApplicationQueueStatus, 'submitted'>
  ) => Promise<void>;
  onRetryQueueEntry: (queueId: string) => Promise<void>;
  onRecordManualReceipt: (queueId: string) => Promise<void>;
  onRunBrowserCheck: (queueId: string) => Promise<void>;
  onRunBrowserCheckBatch: (queueIds: string[]) => Promise<void>;
  onRunGuardedSubmit: (queueId: string) => Promise<void>;
  onRunGuardedSubmitBatch: (queueIds: string[]) => Promise<void>;
  onSaveProfileAnswer: (input: {
    category: ProfileAnswerCategory;
    label: string;
    answer: string;
    sensitive: boolean;
  }) => Promise<void>;
  onDeleteProfileAnswer: (id: string) => Promise<void>;
}

const PROFILE_CATEGORIES: Array<{ value: ProfileAnswerCategory; label: string }> = [
  { value: 'work_authorization', label: 'Work auth' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'links', label: 'Links' },
  { value: 'location', label: 'Location' },
  { value: 'salary', label: 'Salary' },
  { value: 'open_ended', label: 'Open-ended' },
  { value: 'identity', label: 'Identity' },
  { value: 'other', label: 'Other' },
];

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

const FAILURE_CODE_SET: Record<ApplyAgentFailureCode, true> = {
  provider_unsupported: true,
  captcha_detected: true,
  file_upload_required: true,
  missing_required_fields: true,
  submit_button_missing: true,
  form_not_found: true,
  browser_unavailable: true,
  browser_navigation_failed: true,
  confirmation_missing: true,
  runtime_failure: true,
};

function receiptFailureCode(receipt: ApplicationReceipt | undefined): ApplyAgentFailureCode | null {
  const value = receipt?.fields.find(
    (field) => field.label.toLowerCase() === 'failure code'
  )?.value;
  if (!value || value === 'none') return null;
  return value in FAILURE_CODE_SET ? (value as ApplyAgentFailureCode) : null;
}

function receiptFieldValue(receipt: ApplicationReceipt, label: string): string | null {
  return (
    receipt.fields.find((field) => field.label.toLowerCase() === label.toLowerCase())?.value ?? null
  );
}

export function ApplyAgentCommandCenter({
  jobs,
  resumeCount,
  fitScores,
  queue,
  receipts,
  packets,
  profileAnswers,
  discoveryAlerts,
  onQueueApplication,
  onQueueDiscoveryAlert,
  onQueueReadyApplications,
  onRefreshReadiness,
  onUpdateQueueStatus,
  onBulkUpdateQueueStatus,
  onRetryQueueEntry,
  onRecordManualReceipt,
  onRunBrowserCheck,
  onRunBrowserCheckBatch,
  onRunGuardedSubmit,
  onRunGuardedSubmitBatch,
  onSaveProfileAnswer,
  onDeleteProfileAnswer,
}: ApplyAgentCommandCenterProps) {
  const [profileCategory, setProfileCategory] =
    useState<ProfileAnswerCategory>('work_authorization');
  const [profileLabel, setProfileLabel] = useState('Authorized to work in US?');
  const [profileAnswer, setProfileAnswer] = useState('');
  const [profileSensitive, setProfileSensitive] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [packetJobId, setPacketJobId] = useState<string | null>(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(() => new Set());
  const [checkingQueueId, setCheckingQueueId] = useState<string | null>(null);
  const [checkingBatch, setCheckingBatch] = useState(false);
  const [submittingQueueId, setSubmittingQueueId] = useState<string | null>(null);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [browserCheckError, setBrowserCheckError] = useState<string | null>(null);
  const summary = useMemo(() => {
    const tailored = jobs.filter((job) => job.status === 'tailored');
    const drafts = jobs.filter((job) => job.status === 'draft');
    const submitted = jobs.filter((job) =>
      ['applied', 'interview', 'offer', 'rejected'].includes(job.status)
    );
    const ready = tailored.slice().sort((a, b) => b.updated_at - a.updated_at);
    const nextReady = ready[0];

    return {
      drafts: drafts.length,
      ready: ready.length,
      submitted: submitted.length,
      nextReady,
    };
  }, [jobs]);

  const nextStep =
    resumeCount === 0
      ? 'Create a base resume before building an application queue.'
      : jobs.length === 0
        ? 'Add job URLs or run a saved search to build your queue.'
        : summary.ready > 0
          ? `Review ${summary.nextReady?.role || 'the next tailored role'} at ${summary.nextReady?.company || 'the target company'} before submitting.`
          : summary.drafts > 0
            ? 'Tailor draft jobs first so the queue has reviewed materials.'
            : 'Keep adding high-fit roles, then review receipts as applications move forward.';

  const queuedJobIds = useMemo(() => new Set(queue.map((entry) => entry.job_id)), [queue]);
  const receiptsByJob = useMemo(() => {
    const map = new Map<string, ApplicationReceipt>();
    for (const receipt of receipts) {
      if (!map.has(receipt.job_id)) map.set(receipt.job_id, receipt);
    }
    return map;
  }, [receipts]);
  const automationHealth = useMemo(() => {
    const browserReceipts = receipts.filter((receipt) =>
      Boolean(receiptFieldValue(receipt, 'Browser runner mode'))
    );
    const submitReceipts = browserReceipts.filter((receipt) =>
      /guarded browser submit/i.test(receiptFieldValue(receipt, 'Browser runner mode') ?? '')
    );
    const providerMap = new Map<
      string,
      { provider: string; attempts: number; submitted: number; blocked: number }
    >();
    const failureMap = new Map<
      ApplyAgentFailureCode,
      { count: number; providers: Map<string, number> }
    >();

    for (const receipt of browserReceipts) {
      const provider = receipt.provider || 'unknown';
      const current = providerMap.get(provider) ?? {
        provider,
        attempts: 0,
        submitted: 0,
        blocked: 0,
      };
      current.attempts += 1;
      if (receipt.status === 'submitted') current.submitted += 1;
      if (receipt.status === 'failed' || receipt.status === 'skipped') current.blocked += 1;
      providerMap.set(provider, current);

      const failureCode = receiptFailureCode(receipt);
      if (failureCode) {
        const failure = failureMap.get(failureCode) ?? { count: 0, providers: new Map() };
        failure.count += 1;
        failure.providers.set(provider, (failure.providers.get(provider) ?? 0) + 1);
        failureMap.set(failureCode, failure);
      }
    }

    const submitSuccesses = submitReceipts.filter(
      (receipt) => receipt.status === 'submitted'
    ).length;

    return {
      browserReceipts: browserReceipts.length,
      submitAttempts: submitReceipts.length,
      submitSuccesses,
      providers: Array.from(providerMap.values()).sort(
        (a, b) => b.attempts - a.attempts || b.submitted - a.submitted
      ),
      failures: Array.from(failureMap.entries())
        .map(([code, failure]) => ({
          code,
          count: failure.count,
          provider:
            Array.from(failure.providers.entries()).sort(
              (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
            )[0]?.[0] ?? null,
        }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    };
  }, [receipts]);
  const packetsByJob = useMemo(
    () => new Map(packets.map((packet) => [packet.job_id, packet])),
    [packets]
  );
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const queueableReadyCount = jobs.filter(
    (job) => job.status === 'tailored' && !queuedJobIds.has(job.id)
  ).length;
  const matchFeed = useMemo(() => {
    const statusBoost: Record<JobApplication['status'], number> = {
      tailored: 15,
      draft: 5,
      applied: -20,
      interview: -30,
      offer: -40,
      rejected: -80,
    };
    return jobs
      .map((job) => ({
        job,
        fit: fitScores[job.id],
        score: (fitScores[job.id] ?? 50) + statusBoost[job.status],
      }))
      .filter((item) => !['offer', 'rejected'].includes(item.job.status))
      .sort((a, b) => b.score - a.score || b.job.updated_at - a.job.updated_at)
      .slice(0, 5);
  }, [fitScores, jobs]);
  const actionableDiscoveryAlerts = useMemo(
    () =>
      discoveryAlerts
        .filter((alert) => Boolean(alert.job_url))
        .sort(
          (a, b) => Number(Boolean(a.seen)) - Number(Boolean(b.seen)) || b.created_at - a.created_at
        )
        .slice(0, 4),
    [discoveryAlerts]
  );
  const filteredQueue = useMemo(() => {
    if (queueFilter === 'all') return queue;
    if (queueFilter === 'ready') {
      return queue.filter(
        (entry) =>
          entry.status === 'ready_to_submit' || entry.readiness.status === 'ready_for_review'
      );
    }
    return queue.filter((entry) => entry.status === queueFilter);
  }, [queue, queueFilter]);
  const visibleQueueIds = useMemo(
    () => filteredQueue.slice(0, 8).map((entry) => entry.id),
    [filteredQueue]
  );
  const selectedVisibleCount = visibleQueueIds.filter((id) => selectedQueueIds.has(id)).length;
  const selectedQueueCount = selectedQueueIds.size;
  const allVisibleSelected =
    visibleQueueIds.length > 0 && selectedVisibleCount === visibleQueueIds.length;

  const readiness = [
    { label: 'Needs tailoring', value: summary.drafts, icon: Sparkles },
    { label: 'Ready for review', value: summary.ready, icon: FileCheck2 },
    { label: 'Submitted / tracked', value: summary.submitted, icon: ClipboardCheck },
  ];

  const roadmap = [
    { label: 'Resume and cover letter prep', state: 'Live' },
    { label: 'Application queue states', state: 'Live' },
    { label: 'Profile answers', state: profileAnswers.length > 0 ? 'Live' : 'Needed' },
    { label: 'Reviewed browser check', state: 'Live' },
    { label: 'Guarded browser submit', state: 'Live' },
    { label: 'Bulk unattended apply', state: 'Planned' },
    { label: 'Manual receipts', state: 'Live' },
  ];

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileLabel.trim() || !profileAnswer.trim()) return;
    setSavingProfile(true);
    try {
      await onSaveProfileAnswer({
        category: profileCategory,
        label: profileLabel,
        answer: profileAnswer,
        sensitive: profileSensitive,
      });
      setProfileAnswer('');
    } finally {
      setSavingProfile(false);
    }
  }

  function toggleQueueSelection(queueId: string) {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (next.has(queueId)) next.delete(queueId);
      else next.add(queueId);
      return next;
    });
  }

  function toggleVisibleQueueSelection() {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleQueueIds) next.delete(id);
      } else {
        for (const id of visibleQueueIds) next.add(id);
      }
      return next;
    });
  }

  async function handleBulkStatus(status: Exclude<ApplicationQueueStatus, 'submitted'>) {
    const queueIds = Array.from(selectedQueueIds);
    if (queueIds.length === 0) return;
    await onBulkUpdateQueueStatus(queueIds, status);
    setSelectedQueueIds(new Set());
  }

  async function handleBrowserCheck(queueId: string) {
    setCheckingQueueId(queueId);
    setBrowserCheckError(null);
    try {
      await onRunBrowserCheck(queueId);
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Browser check failed');
    } finally {
      setCheckingQueueId(null);
    }
  }

  async function handleBrowserCheckBatch() {
    const queueIds = Array.from(selectedQueueIds);
    if (queueIds.length === 0) return;
    setCheckingBatch(true);
    setBrowserCheckError(null);
    try {
      await onRunBrowserCheckBatch(queueIds);
      setSelectedQueueIds(new Set());
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Browser checks failed');
    } finally {
      setCheckingBatch(false);
    }
  }

  async function handleGuardedSubmit(queueId: string) {
    const confirmed = window.confirm(
      'RolePatch will use Cloudflare Browser Rendering to fill the ATS page and click submit only if no CAPTCHA, file upload, or required-field blocker remains. Continue?'
    );
    if (!confirmed) return;
    setSubmittingQueueId(queueId);
    setBrowserCheckError(null);
    try {
      await onRunGuardedSubmit(queueId);
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Guarded submit failed');
    } finally {
      setSubmittingQueueId(null);
    }
  }

  async function handleGuardedSubmitBatch() {
    const queueIds = Array.from(selectedQueueIds).filter(
      (id) => queue.find((entry) => entry.id === id)?.status === 'ready_to_submit'
    );
    if (queueIds.length === 0) {
      setBrowserCheckError('Select at least one ready queue entry before guarded submit.');
      return;
    }
    const confirmed = window.confirm(
      `RolePatch will run guarded Browser Rendering submit for ${queueIds.length} ready queue ${
        queueIds.length === 1 ? 'entry' : 'entries'
      }. It will refuse CAPTCHA, file uploads, and missing required fields. Continue?`
    );
    if (!confirmed) return;
    setSubmittingBatch(true);
    setBrowserCheckError(null);
    try {
      await onRunGuardedSubmitBatch(queueIds);
      setSelectedQueueIds(new Set());
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Guarded submit batch failed');
    } finally {
      setSubmittingBatch(false);
    }
  }

  const queueFilters: Array<{ key: QueueFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: queue.length },
    {
      key: 'ready',
      label: 'Ready',
      count: queue.filter(
        (entry) =>
          entry.status === 'ready_to_submit' || entry.readiness.status === 'ready_for_review'
      ).length,
    },
    {
      key: 'needs_user',
      label: 'Needs you',
      count: queue.filter((entry) => entry.status === 'needs_user').length,
    },
    {
      key: 'failed',
      label: 'Failed',
      count: queue.filter((entry) => entry.status === 'failed').length,
    },
    {
      key: 'skipped',
      label: 'Skipped',
      count: queue.filter((entry) => entry.status === 'skipped').length,
    },
  ];

  return (
    <section className="mb-12 rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent">
            <Bot className="h-3.5 w-3.5" />
            Apply agent
          </div>
          <h2 className="font-serif text-2xl font-bold">Command center</h2>
          <p className="mt-1 max-w-2xl text-xs font-medium text-[var(--muted-foreground)] opacity-70">
            Prepare high-volume applications without losing review control. Guarded submit is live;
            bulk unattended apply remains outside the product boundary.
          </p>
        </div>
        <Link
          href="/tools"
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
        >
          Review tools
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-3">
          {readiness.map((item) => (
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
          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Guardrailed roadmap
          </div>
          <div className="space-y-2">
            {roadmap.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--muted-foreground)]">{item.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                    item.state === 'Live'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-[var(--muted-foreground)]'
                  }`}
                >
                  {item.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onQueueReadyApplications()}
          disabled={queueableReadyCount === 0}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Queue ready jobs ({queueableReadyCount})
        </button>
        <button
          type="button"
          onClick={() => void onRefreshReadiness()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh readiness
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)]/60">
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Match feed
          </p>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Top {matchFeed.length}
          </span>
        </div>
        {matchFeed.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            Add jobs and generate fit scores to rank your best applications.
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {matchFeed.map(({ job, fit, score }) => (
              <div
                key={job.id}
                className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {job.role || 'Untitled role'}
                    </p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {job.company || 'Unknown company'}
                    </p>
                  </div>
                  <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-black text-accent">
                    {Math.max(0, Math.min(100, Math.round(score)))}%
                  </span>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                  <span>{fit != null ? `Fit ${fit}` : 'Fit pending'}</span>
                  <span>{job.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tailor/${job.id}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground"
                  >
                    Tailor
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onQueueApplication(job.id)}
                    disabled={queuedJobIds.has(job.id)}
                    className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {queuedJobIds.has(job.id) ? 'Queued' : 'Queue'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionableDiscoveryAlerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5">
          <div className="flex items-center justify-between border-b border-[var(--primary)]/15 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)]">
              Discovery alerts
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)]">
              Queue from saved searches
            </span>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {actionableDiscoveryAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-[var(--border)]/60 bg-background p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {alert.title || 'New role'}
                    </p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {alert.detail}
                    </p>
                  </div>
                  {!alert.seen && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-accent">
                      New
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {alert.job_url && (
                    <a
                      href={alert.job_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground"
                    >
                      Open
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void onQueueDiscoveryAlert(alert)}
                    className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                  >
                    Add to queue
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[var(--border)]/60">
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            <BarChart3 className="h-3.5 w-3.5" />
            Automation health
          </p>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            {plural(automationHealth.browserReceipts, 'browser receipt')}
          </span>
        </div>
        {automationHealth.browserReceipts === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            Run reviewed browser checks to start measuring provider reliability before expanding
            automation.
          </div>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Guarded submits
              </p>
              <p className="mt-2 text-2xl font-black">
                {automationHealth.submitSuccesses}/{automationHealth.submitAttempts}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Confirmed submits over guarded attempts.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Providers observed
              </p>
              <div className="space-y-2">
                {automationHealth.providers.slice(0, 4).map((provider) => (
                  <div key={provider.provider} className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-bold text-foreground">
                      {provider.provider}
                    </span>
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                      {provider.submitted} submitted · {provider.blocked} blocked ·{' '}
                      {provider.attempts} total
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Top blockers
              </p>
              {automationHealth.failures.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  No browser blockers recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {automationHealth.failures.slice(0, 3).map((failure) => (
                    <div key={failure.code}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-foreground">
                          {failureCodeLabel(failure.code)}
                          {failure.provider ? ` · ${failure.provider}` : ''}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                          {failure.count}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                        {getApplyAgentRemediation(failure.provider, failure.code).detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)]/60">
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Application queue
          </p>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            {plural(queue.length, 'entry', 'entries')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)]/60 px-4 py-3">
          {queueFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setQueueFilter(filter.key)}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                queueFilter === filter.key
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground'
              }`}
            >
              {filter.label} {filter.count}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/60 px-4 py-3">
          <button
            type="button"
            onClick={toggleVisibleQueueSelection}
            disabled={visibleQueueIds.length === 0}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            {allVisibleSelected ? 'Clear visible' : 'Select visible'}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {plural(selectedQueueCount, 'selected', 'selected')}
            </span>
            <button
              type="button"
              onClick={() => void handleBulkStatus('ready_to_submit')}
              disabled={selectedQueueCount === 0 || checkingBatch}
              className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Mark ready
            </button>
            <button
              type="button"
              onClick={() => void handleBrowserCheckBatch()}
              disabled={selectedQueueCount === 0 || checkingBatch || submittingBatch}
              className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs font-bold text-[var(--primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {checkingBatch ? 'Checking...' : 'Run checks'}
            </button>
            <button
              type="button"
              onClick={() => void handleGuardedSubmitBatch()}
              disabled={selectedQueueCount === 0 || submittingBatch}
              className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs font-bold text-[var(--primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {submittingBatch ? 'Submitting...' : 'Auto submit'}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStatus('skipped')}
              disabled={selectedQueueCount === 0}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStatus('failed')}
              disabled={selectedQueueCount === 0}
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Mark failed
            </button>
          </div>
        </div>
        {browserCheckError && (
          <div className="border-b border-[var(--border)]/60 px-4 py-3 text-xs font-medium text-destructive">
            {browserCheckError}
          </div>
        )}
        {queue.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            No queued applications yet. Tailor a role, then queue it for review.
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            No applications match this filter.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/50">
            {filteredQueue.slice(0, 8).map((entry) => {
              const job = jobsById.get(entry.job_id);
              const receipt = receiptsByJob.get(entry.job_id);
              const failureCode = receiptFailureCode(receipt);
              const remediation = failureCode
                ? getApplyAgentRemediation(receipt?.provider, failureCode)
                : null;
              const packet = packetsByJob.get(entry.job_id);
              return (
                <div key={entry.id} className="px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <div className="min-w-0">
                      <label className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                        <input
                          type="checkbox"
                          checked={selectedQueueIds.has(entry.id)}
                          onChange={() => toggleQueueSelection(entry.id)}
                          className="accent-[var(--primary)]"
                          aria-label={`Select ${job?.role || 'queued role'}`}
                        />
                        Select
                      </label>
                      <p className="truncate text-sm font-bold text-foreground">
                        {job?.role || 'Queued role'}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {job?.company || 'Unknown company'} · {entry.readiness.summary}
                      </p>
                      {entry.readiness.missing.length > 0 && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                          Missing: {entry.readiness.missing.join(', ')}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(entry.readiness.checks).map(([key, passed]) => (
                          <span
                            key={key}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                              passed
                                ? 'border-accent/20 bg-accent/10 text-accent'
                                : 'border-[var(--border)] bg-muted text-[var(--muted-foreground)]'
                            }`}
                          >
                            {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {key.replaceAll('_', ' ')}
                          </span>
                        ))}
                      </div>
                      {receipt && (
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-accent">
                            Receipt: {receipt.provider || 'unknown'} · {receipt.confirmation_text}
                          </p>
                          {remediation && (
                            <p className="text-xs text-[var(--muted-foreground)]">
                              Next: {remediation.title} — {remediation.detail}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <select
                      value={entry.status}
                      onChange={(event) =>
                        void onUpdateQueueStatus(
                          entry.id,
                          event.target.value as ApplicationQueueStatus
                        )
                      }
                      className="h-9 rounded-lg border border-[var(--border)] bg-background px-3 text-xs font-bold text-foreground"
                    >
                      {APPLICATION_QUEUE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {queueStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 md:justify-end">
                      {!queuedJobIds.has(entry.job_id) && (
                        <button
                          type="button"
                          onClick={() => void onQueueApplication(entry.job_id)}
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)]"
                        >
                          Queue
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onRecordManualReceipt(entry.id)}
                        disabled={entry.status === 'submitted'}
                        className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        Mark submitted
                      </button>
                      {entry.status !== 'submitted' && (
                        <button
                          type="button"
                          onClick={() => void onRetryQueueEntry(entry.id)}
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleBrowserCheck(entry.id)}
                        disabled={entry.status === 'submitted' || checkingQueueId === entry.id}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                      >
                        {checkingQueueId === entry.id ? 'Checking...' : 'Browser check'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGuardedSubmit(entry.id)}
                        disabled={
                          entry.status !== 'ready_to_submit' || submittingQueueId === entry.id
                        }
                        className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs font-bold text-[var(--primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {submittingQueueId === entry.id ? 'Submitting...' : 'Auto submit'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPacketJobId(packetJobId === entry.job_id ? null : entry.job_id)
                        }
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground"
                      >
                        Packet
                      </button>
                    </div>
                  </div>
                  {packetJobId === entry.job_id && job && (
                    <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                          Prepared application packet
                        </p>
                        {(packet?.ats_url || job.url) && (
                          <a
                            href={packet?.ats_url || job.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline"
                          >
                            {packet?.ats_provider || 'ATS'} page{' '}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Link
                          href={`/tailor/${job.id}`}
                          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          Resume: {packet?.tailored_resume_id ? 'tailored' : 'needs tailoring'}
                        </Link>
                        <Link
                          href={`/cover-letter/${job.id}`}
                          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          Cover letter: {packet?.cover_letter_id ? 'ready' : 'create'}
                        </Link>
                        <Link
                          href={`/interview-prep/${job.id}`}
                          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          Interview prep
                        </Link>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-[var(--border)]/60 bg-background p-3">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                            Resume material
                          </p>
                          <p className="text-xs font-bold text-foreground">
                            {packet?.resume_name || 'Base resume'}
                          </p>
                          <p className="mt-1 line-clamp-3 text-xs text-[var(--muted-foreground)]">
                            {packet?.tailored_excerpt || 'Tailor this role before applying.'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[var(--border)]/60 bg-background p-3">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                            Cover letter
                          </p>
                          <p className="line-clamp-4 text-xs text-[var(--muted-foreground)]">
                            {packet?.cover_letter_excerpt ||
                              'Generate a cover letter for this role.'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {(packet?.profile_answers ?? profileAnswers).length === 0 ? (
                          <p className="text-sm text-[var(--muted-foreground)]">
                            Add profile answers below to make the packet copy-ready.
                          </p>
                        ) : (
                          (packet?.profile_answers ?? profileAnswers).slice(0, 6).map((answer) => (
                            <div
                              key={answer.id}
                              className="rounded-lg border border-[var(--border)]/60 bg-background p-3"
                            >
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-foreground">{answer.label}</p>
                                <Copy className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                              </div>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {answer.answer}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      {packet?.receipt && (
                        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/10 p-3">
                          <p className="text-xs font-bold text-accent">
                            Receipt recorded: {packet.receipt.provider || 'unknown provider'}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {packet.receipt.fields.length} fields captured ·{' '}
                            {packet.receipt.confirmation_text || 'No confirmation text'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={handleProfileSubmit}
          className="rounded-xl border border-[var(--border)]/60 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              Profile answers
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {plural(profileAnswers.length, 'answer')}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-[160px_1fr]">
            <select
              value={profileCategory}
              onChange={(event) => setProfileCategory(event.target.value as ProfileAnswerCategory)}
              className="h-10 rounded-lg border border-[var(--border)] bg-background px-3 text-xs font-bold text-foreground"
            >
              {PROFILE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <input
              value={profileLabel}
              onChange={(event) => setProfileLabel(event.target.value)}
              placeholder="ATS question label"
              className="input-base"
            />
          </div>
          <textarea
            value={profileAnswer}
            onChange={(event) => setProfileAnswer(event.target.value)}
            placeholder="Answer exactly how it should be used in applications"
            className="input-base mt-3 min-h-20"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={profileSensitive}
                onChange={(event) => setProfileSensitive(event.target.checked)}
                className="accent-[var(--primary)]"
              />
              Require review before use
            </label>
            <button
              type="submit"
              disabled={savingProfile || !profileLabel.trim() || !profileAnswer.trim()}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {savingProfile ? 'Saving...' : 'Save answer'}
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-[var(--border)]/60 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Reused in receipts
          </p>
          {profileAnswers.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Add work authorization, sponsorship, links, and salary answers before browser apply.
            </p>
          ) : (
            <div className="space-y-2">
              {profileAnswers.slice(0, 5).map((answer) => (
                <div
                  key={answer.id}
                  className="rounded-lg border border-[var(--border)]/50 bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{answer.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                        {answer.answer}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDeleteProfileAnswer(answer.id)}
                      className="text-xs font-bold text-[var(--muted-foreground)] hover:text-destructive"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-medium text-foreground">Next step:</span>
          <span className="text-[var(--muted-foreground)]">{nextStep}</span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
          {plural(jobs.length, 'job')} tracked
        </span>
      </div>
    </section>
  );
}
