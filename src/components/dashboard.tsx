'use client';

import { AlertCircle, ArrowRight, Calendar, FileText, Globe, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AchievementEvidenceBank } from '@/components/achievement-evidence-bank';
import { ApplyAgentCommandCenter } from '@/components/apply-agent-command-center';
import { ApplicationCampaignTracker } from '@/components/application-campaign-tracker';
import { ATSScoreMini } from '@/components/ats-score-badge';
import { useAuth } from '@/components/auth-provider';
import { CreateResumeButton } from '@/components/create-resume-button';
import { FitScoreBadge } from '@/components/fit-score-card';
import { JobDetailsModal, type JobDetailsModalInitialValues } from '@/components/job-details-modal';
import { JobDiscovery, type DiscoveryQueueContext } from '@/components/job-discovery';
import { JobSearchTips } from '@/components/job-search-tips';
import { MigrationBanner } from '@/components/migration-banner';
import { NewJobButton } from '@/components/new-job-button';
import { RecruiterReplyRoutingCard } from '@/components/recruiter-reply-routing-card';
import { ResumeImportButton } from '@/components/resume-import-button';
import {
  bulkUpdateApplicationQueueStatus,
  listApplicationPackets,
  listApplicationQueue,
  listApplicationReceipts,
  queueApplication,
  recordManualApplicationReceipt,
  refreshApplicationQueueReadiness,
  retryApplicationQueueEntry,
  runGuardedBrowserSubmit,
  runGuardedBrowserSubmitBatch,
  runReviewedBrowserCheckBatch,
  runReviewedBrowserCheck,
  updateApplicationQueueStatus,
} from '@/lib/actions/apply-agent-actions';
import { createJobApplication, updateJobDetails, updateJobStatus } from '@/lib/actions/job-actions';
import {
  deleteProfileAnswer,
  listProfileAnswers,
  saveProfileAnswer,
} from '@/lib/actions/profile-answer-actions';
import {
  localBulkUpdateApplicationQueueStatus,
  localDeleteProfileAnswer,
  localListApplicationPackets,
  localListApplicationQueue,
  localListApplicationReceipts,
  localListAchievementEvidence,
  localListJobDiscoveryAlerts,
  localListJobs,
  localListProfileAnswers,
  localListResumes,
  localQueueApplication,
  localRecordManualApplicationReceipt,
  localRefreshApplicationQueueReadiness,
  localSaveJob,
  localRetryApplicationQueueEntry,
  localSaveProfileAnswer,
  localUpdateApplicationQueueStatus,
  localUpdateJobDetails,
  localUpdateJobStatus,
} from '@/lib/local-storage';
import { normalizeJobUrl } from '@/lib/job-discovery-alerts';
import type { DiscoveredJob } from '@/lib/job-discovery-types';
import type {
  AchievementEvidence,
  ApplicationPacket,
  ApplicationQueueEntry,
  ApplicationQueueStatus,
  ApplicationReceipt,
  ApplyAgentDiscoveryAlert,
  JobApplication,
  JobDetailsPatch,
  ProfileAnswer,
  ProfileAnswerCategory,
  RecruiterReplyEvent,
  Resume,
} from '@/lib/types';

const STATUS_OPTIONS: JobApplication['status'][] = [
  'draft',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
];

const statusConfig: Record<
  string,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  draft: {
    label: 'Draft',
    dot: 'bg-muted-foreground',
    bg: 'bg-muted',
    text: 'text-[var(--muted-foreground)]',
    border: 'border-[var(--border)]',
  },
  tailored: {
    label: 'Tailored',
    dot: 'bg-[var(--primary)]',
    bg: 'bg-[var(--primary)]/5',
    text: 'text-[var(--primary)]',
    border: 'border-[var(--primary)]/20',
  },
  applied: {
    label: 'Applied',
    dot: 'bg-accent',
    bg: 'bg-accent/5',
    text: 'text-accent',
    border: 'border-accent/20',
  },
  interview: {
    label: 'Interview',
    dot: 'bg-accent',
    bg: 'bg-accent/10',
    text: 'text-accent',
    border: 'border-accent/30',
  },
  offer: {
    label: 'Offer',
    dot: 'bg-accent',
    bg: 'bg-accent/20',
    text: 'text-accent',
    border: 'border-accent/40',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-destructive',
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
  },
};

type DashboardJob = Pick<
  JobApplication,
  | 'id'
  | 'resume_id'
  | 'url'
  | 'company'
  | 'role'
  | 'status'
  | 'created_at'
  | 'updated_at'
  | 'interview_date'
  | 'follow_up_at'
  | 'salary_min'
  | 'salary_max'
  | 'salary_currency'
  | 'offer_amount'
  | 'notes'
  | 'rejection_reason'
>;

interface DashboardProps {
  serverResumes: Resume[];
  serverJobs: JobApplication[];
  serverFitScores?: Record<string, number>;
  serverEvidence?: AchievementEvidence[];
  serverApplicationQueue?: ApplicationQueueEntry[];
  serverApplicationReceipts?: ApplicationReceipt[];
  serverApplicationPackets?: ApplicationPacket[];
  serverProfileAnswers?: ProfileAnswer[];
  serverJobDiscoveryAlerts?: ApplyAgentDiscoveryAlert[];
  serverReplyRoutingAddress?: string | null;
  serverRecruiterReplyEvents?: RecruiterReplyEvent[];
}

function toDashboardJob(j: JobApplication): DashboardJob {
  return {
    id: j.id,
    resume_id: j.resume_id,
    url: j.url,
    company: j.company,
    role: j.role,
    status: j.status,
    created_at: j.created_at,
    updated_at: j.updated_at,
    interview_date: j.interview_date ?? null,
    follow_up_at: j.follow_up_at ?? null,
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    salary_currency: j.salary_currency ?? null,
    offer_amount: j.offer_amount ?? null,
    notes: j.notes ?? null,
    rejection_reason: j.rejection_reason ?? null,
  };
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function Dashboard({
  serverResumes,
  serverJobs,
  serverFitScores,
  serverEvidence = [],
  serverApplicationQueue = [],
  serverApplicationReceipts = [],
  serverApplicationPackets = [],
  serverProfileAnswers = [],
  serverJobDiscoveryAlerts = [],
  serverReplyRoutingAddress = null,
  serverRecruiterReplyEvents = [],
}: DashboardProps) {
  const { isGuest } = useAuth();
  const [resumes, setResumes] = useState(serverResumes);
  const [jobs, setJobs] = useState<DashboardJob[]>(serverJobs.map(toDashboardJob));
  const [atsScores, setAtsScores] = useState<
    Record<string, { original: number; tailored: number }>
  >({});
  const [fitScores] = useState<Record<string, number>>(serverFitScores ?? {});
  const [evidence, setEvidence] = useState(serverEvidence);
  const [applicationQueue, setApplicationQueue] = useState(serverApplicationQueue);
  const [applicationReceipts, setApplicationReceipts] = useState(serverApplicationReceipts);
  const [applicationPackets, setApplicationPackets] = useState(serverApplicationPackets);
  const [profileAnswers, setProfileAnswers] = useState(serverProfileAnswers);
  const [jobDiscoveryAlerts, setJobDiscoveryAlerts] = useState(serverJobDiscoveryAlerts);
  const [detailsJobId, setDetailsJobId] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState<number>(0);

  // Intentional: hydrate from localStorage for guest users after auth context resolves
  useEffect(() => {
    if (isGuest) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setResumes(localListResumes());
      setJobs(localListJobs());
      setEvidence(localListAchievementEvidence());
      setApplicationQueue(localListApplicationQueue());
      setApplicationReceipts(localListApplicationReceipts());
      setApplicationPackets(localListApplicationPackets());
      setProfileAnswers(localListProfileAnswers());
      setJobDiscoveryAlerts(localListJobDiscoveryAlerts());
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isGuest]);

  // Capture a stable "now" for alerts (client-only to avoid impure render)
  useEffect(() => {
    setNowSec(Math.floor(Date.now() / 1000)); // eslint-disable-line react-hooks/set-state-in-effect -- client-only seed
  }, []);

  // Load cached ATS scores from localStorage
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('rt-ats-scores') ?? '{}');
      if (Object.keys(cached).length > 0) {
        setAtsScores(cached); // eslint-disable-line react-hooks/set-state-in-effect -- hydrate from localStorage
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function handleStatusChange(jobId: string, newStatus: string) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, status: newStatus as JobApplication['status'] } : j
      )
    );
    if (isGuest) {
      localUpdateJobStatus(jobId, newStatus as JobApplication['status']);
    } else {
      await updateJobStatus(jobId, newStatus);
    }
  }

  async function handleDetailsSave(jobId: string, patch: JobDetailsPatch): Promise<void> {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...patch } : j)));
    if (isGuest) {
      localUpdateJobDetails(jobId, patch);
    } else {
      await updateJobDetails(jobId, patch);
    }
  }

  async function refreshApplyAgentState(): Promise<void> {
    if (isGuest) {
      setApplicationQueue(localListApplicationQueue());
      setApplicationReceipts(localListApplicationReceipts());
      setApplicationPackets(localListApplicationPackets());
      setProfileAnswers(localListProfileAnswers());
      return;
    }

    const [queue, receipts, packets, answers] = await Promise.all([
      listApplicationQueue(),
      listApplicationReceipts(),
      listApplicationPackets(),
      listProfileAnswers(),
    ]);
    setApplicationQueue(queue);
    setApplicationReceipts(receipts);
    setApplicationPackets(packets);
    setProfileAnswers(answers);
  }

  async function handleQueueApplication(jobId: string): Promise<void> {
    if (isGuest) {
      localQueueApplication(jobId);
      await refreshApplyAgentState();
      return;
    }
    await queueApplication(jobId);
    await refreshApplyAgentState();
  }

  function discoveryQueueNote(context?: DiscoveryQueueContext): string | null {
    if (!context?.semanticScore) return null;
    const evidence =
      context.matchTerms && context.matchTerms.length > 0
        ? ` Evidence: ${context.matchTerms.join(', ')}.`
        : '';
    return `RolePatch semantic match: ${context.semanticScore}% resume match.${evidence}`;
  }

  function mergeRolePatchQueueNote(
    existing: string | null | undefined,
    note: string | null,
    marker: string
  ): string | null {
    if (!note) return existing ?? null;
    if (!existing?.trim()) return note;
    if (existing.includes(marker)) return existing;
    return `${existing.trim()}\n\n${note}`;
  }

  function discoveryAlertNote(alert: ApplyAgentDiscoveryAlert): string {
    const parts = [alert.source, alert.location].filter(Boolean);
    return parts.length > 0
      ? `RolePatch discovery alert: ${parts.join(' · ')}.`
      : 'RolePatch discovery alert.';
  }

  async function handleQueueDiscoveryAlert(alert: ApplyAgentDiscoveryAlert): Promise<void> {
    if (!alert.job_url) throw new Error('This discovery alert does not include a job URL');
    const resume = resumes[0];
    if (!resume) throw new Error('Create a base resume before queueing discovery alerts');
    const normalizedAlertUrl = normalizeJobUrl(alert.job_url);
    const existing = jobs.find((job) => job.url && normalizeJobUrl(job.url) === normalizedAlertUrl);
    const note = discoveryAlertNote(alert);
    if (existing) {
      const mergedNote = mergeRolePatchQueueNote(existing.notes, note, 'RolePatch discovery alert');
      if (mergedNote !== existing.notes) {
        if (isGuest) localUpdateJobDetails(existing.id, { notes: mergedNote });
        else await updateJobDetails(existing.id, { notes: mergedNote });
        setJobs((prev) =>
          prev.map((job) => (job.id === existing.id ? { ...job, notes: mergedNote } : job))
        );
      }
      await handleQueueApplication(existing.id);
      return;
    }

    const company = alert.company || alert.detail.split('·')[0]?.trim() || 'Unknown Company';
    const role = alert.title || 'Untitled Role';
    const jdText = alert.detail || `${company} discovery alert`;

    if (isGuest) {
      const jobId = crypto.randomUUID();
      localSaveJob(jobId, company, role, resume.id, alert.job_url, jdText, jdText);
      localUpdateJobDetails(jobId, { notes: note });
      localQueueApplication(jobId);
      setJobs(localListJobs());
      await refreshApplyAgentState();
      return;
    }

    const jobId = await createJobApplication(
      resume.id,
      alert.job_url,
      company,
      role,
      jdText,
      jdText
    );
    await updateJobDetails(jobId, { notes: note });
    await queueApplication(jobId);
    const now = Math.floor(Date.now() / 1000);
    setJobs((prev) => [
      {
        id: jobId,
        resume_id: resume.id,
        url: alert.job_url ?? '',
        company,
        role,
        status: 'draft',
        created_at: now,
        updated_at: now,
        interview_date: null,
        follow_up_at: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        offer_amount: null,
        notes: note,
        rejection_reason: null,
      },
      ...prev,
    ]);
    await refreshApplyAgentState();
  }

  async function handleQueueDiscoveryAlerts(alerts: ApplyAgentDiscoveryAlert[]): Promise<void> {
    const seenUrls = new Set<string>();
    const uniqueAlerts = alerts.filter((alert) => {
      if (!alert.job_url) return false;
      const normalized = normalizeJobUrl(alert.job_url);
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      return true;
    });
    for (const alert of uniqueAlerts) {
      await handleQueueDiscoveryAlert(alert);
    }
  }

  async function handleQueueDiscoveredJob(
    job: DiscoveredJob,
    resumeId: string,
    context?: DiscoveryQueueContext
  ): Promise<void> {
    if (!job.job_url) throw new Error('This job does not include a job URL');
    if (!resumeId) throw new Error('Create a base resume before queueing jobs');
    const note = discoveryQueueNote(context);
    const normalizedJobUrl = normalizeJobUrl(job.job_url);
    const existing = jobs.find(
      (item) => item.url && normalizeJobUrl(item.url) === normalizedJobUrl
    );
    if (existing) {
      const mergedNote = mergeRolePatchQueueNote(existing.notes, note, 'RolePatch semantic match:');
      if (mergedNote !== existing.notes) {
        if (isGuest) localUpdateJobDetails(existing.id, { notes: mergedNote });
        else await updateJobDetails(existing.id, { notes: mergedNote });
        setJobs((prev) =>
          prev.map((item) => (item.id === existing.id ? { ...item, notes: mergedNote } : item))
        );
      }
      await handleQueueApplication(existing.id);
      return;
    }

    const company = job.company || 'Unknown Company';
    const role = job.title || 'Untitled Role';
    const jdText = job.description || job.description_short || `${role} at ${company}`;

    if (isGuest) {
      const jobId = crypto.randomUUID();
      localSaveJob(jobId, company, role, resumeId, job.job_url, jdText, jdText);
      if (note) localUpdateJobDetails(jobId, { notes: note });
      localQueueApplication(jobId);
      setJobs(localListJobs());
      await refreshApplyAgentState();
      return;
    }

    const jobId = await createJobApplication(resumeId, job.job_url, company, role, jdText, jdText);
    if (note) await updateJobDetails(jobId, { notes: note });
    await queueApplication(jobId);
    const now = Math.floor(Date.now() / 1000);
    setJobs((prev) => [
      {
        id: jobId,
        resume_id: resumeId,
        url: job.job_url ?? '',
        company,
        role,
        status: 'draft',
        created_at: now,
        updated_at: now,
        interview_date: null,
        follow_up_at: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        offer_amount: null,
        notes: note,
        rejection_reason: null,
      },
      ...prev,
    ]);
    await refreshApplyAgentState();
  }

  async function handleQueueReadyApplications(): Promise<void> {
    const queued = new Set(applicationQueue.map((entry) => entry.job_id));
    const readyJobs = jobs.filter((job) => job.status === 'tailored' && !queued.has(job.id));
    if (isGuest) {
      for (const job of readyJobs) localQueueApplication(job.id);
      await refreshApplyAgentState();
      return;
    }
    await Promise.all(readyJobs.map((job) => queueApplication(job.id)));
    await refreshApplyAgentState();
  }

  async function handleRefreshReadiness(): Promise<void> {
    if (isGuest) {
      setApplicationQueue(localRefreshApplicationQueueReadiness());
      setApplicationPackets(localListApplicationPackets());
      return;
    }
    setApplicationQueue(await refreshApplicationQueueReadiness());
    setApplicationPackets(await listApplicationPackets());
  }

  async function handleUpdateQueueStatus(
    queueId: string,
    status: ApplicationQueueStatus
  ): Promise<void> {
    if (isGuest) {
      localUpdateApplicationQueueStatus(queueId, status);
      setApplicationQueue(localListApplicationQueue());
      return;
    }
    await updateApplicationQueueStatus(queueId, status);
    setApplicationQueue(await listApplicationQueue());
  }

  async function handleBulkUpdateQueueStatus(
    queueIds: string[],
    status: Exclude<ApplicationQueueStatus, 'submitted'>
  ): Promise<void> {
    if (queueIds.length === 0) return;
    if (isGuest) {
      localBulkUpdateApplicationQueueStatus(queueIds, status);
      setApplicationQueue(localListApplicationQueue());
      return;
    }
    await bulkUpdateApplicationQueueStatus(queueIds, status);
    setApplicationQueue(await listApplicationQueue());
  }

  async function handleRetryQueueEntry(queueId: string): Promise<void> {
    if (isGuest) {
      localRetryApplicationQueueEntry(queueId);
      await refreshApplyAgentState();
      return;
    }
    await retryApplicationQueueEntry(queueId);
    await refreshApplyAgentState();
  }

  async function handleRecordManualReceipt(queueId: string): Promise<void> {
    const entry = applicationQueue.find((item) => item.id === queueId);
    if (isGuest) {
      localRecordManualApplicationReceipt(queueId);
      setJobs(localListJobs());
      await refreshApplyAgentState();
      return;
    }
    await recordManualApplicationReceipt({ queueId });
    if (entry) {
      setJobs((prev) =>
        prev.map((job) => (job.id === entry.job_id ? { ...job, status: 'applied' } : job))
      );
    }
    await refreshApplyAgentState();
  }

  async function handleRunBrowserCheck(queueId: string): Promise<void> {
    if (isGuest) throw new Error('Sign in to run reviewed browser checks');
    await runReviewedBrowserCheck(queueId);
    await refreshApplyAgentState();
  }

  async function handleRunBrowserCheckBatch(queueIds: string[]): Promise<void> {
    if (isGuest) throw new Error('Sign in to run reviewed browser checks');
    await runReviewedBrowserCheckBatch(queueIds);
    await refreshApplyAgentState();
  }

  async function handleRunGuardedSubmit(queueId: string): Promise<void> {
    if (isGuest) throw new Error('Sign in to run guarded submit');
    await runGuardedBrowserSubmit(queueId);
    await refreshApplyAgentState();
  }

  async function handleRunGuardedSubmitBatch(queueIds: string[]): Promise<void> {
    if (isGuest) throw new Error('Sign in to run guarded submit');
    await runGuardedBrowserSubmitBatch(queueIds);
    await refreshApplyAgentState();
  }

  async function handleSaveProfileAnswer(input: {
    id?: string;
    category: ProfileAnswerCategory;
    label: string;
    answer: string;
    sensitive: boolean;
  }): Promise<void> {
    if (isGuest) {
      localSaveProfileAnswer(input);
      setApplicationQueue(localRefreshApplicationQueueReadiness());
      await refreshApplyAgentState();
      return;
    }
    await saveProfileAnswer(input);
    setApplicationQueue(await refreshApplicationQueueReadiness());
    await refreshApplyAgentState();
  }

  async function handleDeleteProfileAnswer(id: string): Promise<void> {
    if (isGuest) {
      localDeleteProfileAnswer(id);
      setApplicationQueue(localRefreshApplicationQueueReadiness());
      await refreshApplyAgentState();
      return;
    }
    await deleteProfileAnswer(id);
    setApplicationQueue(await refreshApplicationQueueReadiness());
    await refreshApplyAgentState();
  }

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => ['applied', 'interview'].includes(j.status)).length,
    offers: jobs.filter((j) => j.status === 'offer').length,
  };

  const alerts = useMemo(() => {
    if (nowSec === 0) return { interviewsThisWeek: 0, overdueFollowUps: 0 };
    const weekFromNow = nowSec + 7 * 24 * 60 * 60;
    const interviewsThisWeek = jobs.filter(
      (j) =>
        j.interview_date != null && j.interview_date >= nowSec && j.interview_date <= weekFromNow
    ).length;
    const overdueFollowUps = jobs.filter(
      (j) =>
        j.follow_up_at != null &&
        j.follow_up_at < nowSec &&
        j.status !== 'rejected' &&
        j.status !== 'offer'
    ).length;
    return { interviewsThisWeek, overdueFollowUps };
  }, [jobs, nowSec]);

  const activeDetailsJob = useMemo(
    () => jobs.find((j) => j.id === detailsJobId) ?? null,
    [jobs, detailsJobId]
  );
  // Stable reference keyed on jobId so the modal only resets when switching
  // jobs, not on every parent re-render.
  const detailsInitial = useMemo<JobDetailsModalInitialValues | null>(() => {
    if (!activeDetailsJob) return null;
    return {
      interview_date: activeDetailsJob.interview_date,
      follow_up_at: activeDetailsJob.follow_up_at,
      salary_min: activeDetailsJob.salary_min,
      salary_max: activeDetailsJob.salary_max,
      salary_currency: activeDetailsJob.salary_currency,
      offer_amount: activeDetailsJob.offer_amount,
      notes: activeDetailsJob.notes,
      rejection_reason: activeDetailsJob.rejection_reason,
    };
  }, [activeDetailsJob]);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <MigrationBanner />

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm font-medium text-[var(--muted-foreground)] mt-2 opacity-80">
          {isGuest
            ? 'Guest mode — sign in to save to the cloud'
            : 'Manage your professional assets'}
        </p>
      </div>

      {/* Alerts — interviews this week, overdue follow-ups */}
      {(alerts.interviewsThisWeek > 0 || alerts.overdueFollowUps > 0) && (
        <div className="mb-8 flex flex-wrap gap-3">
          {alerts.interviewsThisWeek > 0 && (
            <div className="flex items-center gap-2.5 bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] rounded-xl px-4 py-2.5 text-xs font-bold">
              <Calendar className="w-4 h-4" />
              <span>
                {alerts.interviewsThisWeek} interview{alerts.interviewsThisWeek === 1 ? '' : 's'}{' '}
                this week
              </span>
            </div>
          )}
          {alerts.overdueFollowUps > 0 && (
            <div className="flex items-center gap-2.5 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 text-[var(--destructive)] rounded-xl px-4 py-2.5 text-xs font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>
                {alerts.overdueFollowUps} overdue follow-up
                {alerts.overdueFollowUps === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats bar — only show when there are jobs */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12">
          {[
            { label: 'Total Applications', value: stats.total, accent: 'text-foreground' },
            { label: 'Active Pipeline', value: stats.active, accent: 'text-[var(--primary)]' },
            { label: 'Offers Secured', value: stats.offers, accent: 'text-accent' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--card)] border border-[var(--border)]/50 rounded-2xl px-6 py-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                {stat.label}
              </p>
              <p className={`text-3xl font-black mt-2 tracking-tight ${stat.accent}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <ApplicationCampaignTracker jobs={jobs} onOpenDetails={setDetailsJobId} />

      {!isGuest && (
        <RecruiterReplyRoutingCard
          address={serverReplyRoutingAddress}
          events={serverRecruiterReplyEvents}
        />
      )}

      <ApplyAgentCommandCenter
        jobs={jobs}
        resumeCount={resumes.length}
        fitScores={fitScores}
        queue={applicationQueue}
        receipts={applicationReceipts}
        packets={applicationPackets}
        profileAnswers={profileAnswers}
        discoveryAlerts={jobDiscoveryAlerts}
        onQueueApplication={handleQueueApplication}
        onQueueDiscoveryAlert={handleQueueDiscoveryAlert}
        onQueueDiscoveryAlerts={handleQueueDiscoveryAlerts}
        onQueueReadyApplications={handleQueueReadyApplications}
        onRefreshReadiness={handleRefreshReadiness}
        onUpdateQueueStatus={handleUpdateQueueStatus}
        onBulkUpdateQueueStatus={handleBulkUpdateQueueStatus}
        onRetryQueueEntry={handleRetryQueueEntry}
        onRecordManualReceipt={handleRecordManualReceipt}
        onRunBrowserCheck={handleRunBrowserCheck}
        onRunBrowserCheckBatch={handleRunBrowserCheckBatch}
        onRunGuardedSubmit={handleRunGuardedSubmit}
        onRunGuardedSubmitBatch={handleRunGuardedSubmitBatch}
        onSaveProfileAnswer={handleSaveProfileAnswer}
        onDeleteProfileAnswer={handleDeleteProfileAnswer}
      />

      <section className="mb-16">
        <AchievementEvidenceBank serverEntries={evidence} compact roleHint={jobs[0]?.role ?? ''} />
      </section>

      {/* Resumes section */}
      <section className="mb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Resumes</h2>
              <p className="text-xs font-medium text-[var(--muted-foreground)] opacity-60">
                Profile bases for AI, frontend, backend, and other tracks
              </p>
            </div>
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] bg-muted px-2.5 py-1 rounded-full">
              {resumes.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ResumeImportButton />
            <CreateResumeButton />
          </div>
        </div>

        {resumes.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] rounded-2xl py-20 flex flex-col items-center justify-center bg-muted/20">
            <div className="w-16 h-16 rounded-full bg-background border border-[var(--border)] flex items-center justify-center mb-6 shadow-sm">
              <FileText className="w-8 h-8 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="text-sm font-bold text-foreground">No resumes curated yet</p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-2">
              Create a base profile to begin the tailoring process
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumes.map((r) => (
              <Link
                key={r.id}
                href={`/editor/${r.id}`}
                className="group relative bg-[var(--card)] border border-[var(--border)]/60 rounded-2xl p-6 hover:border-[var(--primary)]/40 transition-all hover:shadow-xl hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold truncate text-foreground group-hover:text-[var(--primary)] transition-colors text-lg">
                      {r.name}
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mt-2 opacity-60">
                      Refined {timeAgo(r.updated_at)}
                    </p>
                  </div>
                  <div className="ml-3 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors group-hover:translate-x-1 duration-200">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
                {/* Subtle preview lines */}
                <div className="mt-6 space-y-2 opacity-20">
                  <div className="h-1 bg-foreground rounded-full w-full" />
                  <div className="h-1 bg-foreground rounded-full w-4/5" />
                  <div className="h-1 bg-foreground rounded-full w-2/3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Discover jobs section */}
      <section className="mb-16">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Discover jobs</h2>
            <p className="text-xs font-medium text-[var(--muted-foreground)] opacity-60">
              Search LinkedIn or paste any ATS job URL — Ashby, Greenhouse, Lever, and more
            </p>
          </div>
        </div>
        <JobDiscovery
          resumes={resumes.map((r) => ({ id: r.id, name: r.name, source: r.source }))}
          onQueueDiscoveredJob={handleQueueDiscoveredJob}
        />
        <div className="mt-4">
          <JobSearchTips />
        </div>
      </section>

      {/* Job Applications section */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Applications</h2>
              <p className="text-xs font-medium text-[var(--muted-foreground)] opacity-60">
                Your active job pipeline
              </p>
            </div>
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] bg-muted px-2.5 py-1 rounded-full">
              {jobs.length}
            </span>
          </div>
          <NewJobButton resumes={resumes.map((r) => ({ id: r.id, name: r.name }))} />
        </div>

        {jobs.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] rounded-2xl py-20 flex flex-col items-center justify-center bg-muted/20">
            <div className="w-16 h-16 rounded-full bg-background border border-[var(--border)] flex items-center justify-center mb-6 shadow-sm">
              <Globe className="w-8 h-8 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="text-sm font-bold text-foreground">No active applications</p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-2">
              Add your target job URL to start the AI tailoring engine
            </p>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)]/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                {/* Table header */}
                <div className="grid grid-cols-[1.2fr_1fr_140px_80px_80px_100px_40px] gap-4 px-6 py-4 bg-muted/30 border-b border-[var(--border)] text-[10px] font-black text-[var(--muted-foreground)] uppercase tracking-widest">
                  <span>Position</span>
                  <span>Organization</span>
                  <span>Status</span>
                  <span>Fit</span>
                  <span>ATS</span>
                  <span className="text-right">Initiated</span>
                  <span />
                </div>
                {/* Table rows */}
                {jobs.map((job, i) => {
                  const cfg = statusConfig[job.status] ?? statusConfig.draft;
                  const ats = atsScores[job.id];
                  const fit = fitScores[job.id];
                  return (
                    <div
                      key={job.id}
                      className={`group grid grid-cols-[1.2fr_1fr_140px_80px_80px_100px_40px] gap-4 px-6 py-5 items-center hover:bg-muted/10 transition-colors ${i < jobs.length - 1 ? 'border-b border-[var(--border)]/40' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailsJobId(job.id)}
                        className="font-bold truncate text-foreground group-hover:text-accent transition-colors text-left"
                      >
                        {job.role || 'Untitled Role'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailsJobId(job.id)}
                        className="text-sm font-medium text-[var(--muted-foreground)] truncate opacity-80 text-left"
                      >
                        {job.company || 'Unknown Company'}
                      </button>
                      <div>
                        <select
                          value={job.status}
                          onChange={(e) => handleStatusChange(job.id, e.target.value)}
                          className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none transition-all ${cfg.bg} ${cfg.text} ${cfg.border} hover:scale-105 active:scale-95`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {statusConfig[s]?.label ?? s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="font-bold">
                        {fit != null ? (
                          <FitScoreBadge score={fit} />
                        ) : (
                          <span className="text-[10px] font-black text-[var(--muted-foreground)] opacity-30">
                            --
                          </span>
                        )}
                      </span>
                      <span className="font-bold">
                        {ats ? (
                          <ATSScoreMini score={ats.tailored} />
                        ) : (
                          <span className="text-[10px] font-black text-[var(--muted-foreground)] opacity-30">
                            --
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-[var(--muted-foreground)] text-right opacity-60">
                        {timeAgo(job.created_at)}
                      </span>
                      <Link
                        href={`/tailor/${job.id}`}
                        className="flex items-center justify-center w-11 h-11 -my-3 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors justify-self-end"
                        aria-label="Open tailor"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {detailsInitial && activeDetailsJob && (
        <JobDetailsModal
          open={detailsJobId !== null}
          jobTitle={activeDetailsJob.role}
          company={activeDetailsJob.company}
          initial={detailsInitial}
          onClose={() => setDetailsJobId(null)}
          onSave={(patch) => handleDetailsSave(activeDetailsJob.id, patch)}
        />
      )}
    </main>
  );
}
