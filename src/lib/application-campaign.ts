import type { JobApplication } from '@/lib/types';

export type CampaignJob = Pick<
  JobApplication,
  'id' | 'company' | 'role' | 'status' | 'created_at' | 'follow_up_at' | 'interview_date'
>;

export interface CampaignJobWithActivity extends CampaignJob {
  updated_at?: number;
}

export interface CampaignSummary {
  total: number;
  appliedThisWeek: number;
  weeklyTarget: number;
  weeklyProgressPct: number;
  activePipeline: number;
  followUpsDue: number;
  staleDrafts: number;
  interviewCount: number;
  offerCount: number;
  responseRatePct: number;
  statusCounts: Record<JobApplication['status'], number>;
  nextActions: CampaignAction[];
}

export interface CampaignAction {
  jobId: string;
  label: string;
  detail: string;
  tone: 'urgent' | 'focus' | 'normal';
}

const STATUS_ORDER: JobApplication['status'][] = [
  'draft',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
];

function startOfWeek(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000);
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return Math.floor(date.getTime() / 1000);
}

function lastActivityAt(job: CampaignJobWithActivity): number {
  return job.updated_at ?? job.created_at;
}

export function buildCampaignSummary(
  jobs: CampaignJobWithActivity[],
  options: { now?: number; weeklyTarget?: number } = {}
): CampaignSummary {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const weeklyTarget = options.weeklyTarget ?? 15;
  const weekStart = startOfWeek(now);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;

  const statusCounts = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0])) as Record<
    JobApplication['status'],
    number
  >;

  for (const job of jobs) {
    statusCounts[job.status] = (statusCounts[job.status] ?? 0) + 1;
  }

  const appliedThisWeek = jobs.filter(
    (job) =>
      ['applied', 'interview', 'offer', 'rejected'].includes(job.status) &&
      lastActivityAt(job) >= weekStart
  ).length;
  const activePipeline = jobs.filter((job) =>
    ['applied', 'interview', 'offer'].includes(job.status)
  ).length;
  const followUpsDue = jobs.filter(
    (job) =>
      job.follow_up_at != null &&
      job.follow_up_at <= now &&
      !['offer', 'rejected'].includes(job.status)
  ).length;
  const staleDrafts = jobs.filter(
    (job) => ['draft', 'tailored'].includes(job.status) && lastActivityAt(job) < sevenDaysAgo
  ).length;
  const contacted = jobs.filter((job) =>
    ['applied', 'interview', 'offer', 'rejected'].includes(job.status)
  ).length;
  const responses = jobs.filter((job) => ['interview', 'offer'].includes(job.status)).length;

  return {
    total: jobs.length,
    appliedThisWeek,
    weeklyTarget,
    weeklyProgressPct: Math.min(100, Math.round((appliedThisWeek / weeklyTarget) * 100)),
    activePipeline,
    followUpsDue,
    staleDrafts,
    interviewCount: statusCounts.interview,
    offerCount: statusCounts.offer,
    responseRatePct: contacted > 0 ? Math.round((responses / contacted) * 100) : 0,
    statusCounts,
    nextActions: buildNextActions(jobs, now),
  };
}

function buildNextActions(jobs: CampaignJobWithActivity[], now: number): CampaignAction[] {
  const staleCutoff = now - 7 * 24 * 60 * 60;
  const upcomingCutoff = now + 7 * 24 * 60 * 60;
  const actions: CampaignAction[] = [];

  for (const job of jobs) {
    if (
      job.follow_up_at != null &&
      job.follow_up_at <= now &&
      !['offer', 'rejected'].includes(job.status)
    ) {
      actions.push({
        jobId: job.id,
        label: 'Follow up',
        detail: `${job.role || 'Role'} at ${job.company || 'company'}`,
        tone: 'urgent',
      });
    }

    if (
      job.interview_date != null &&
      job.interview_date >= now &&
      job.interview_date <= upcomingCutoff
    ) {
      actions.push({
        jobId: job.id,
        label: 'Prepare interview',
        detail: `${job.role || 'Role'} at ${job.company || 'company'}`,
        tone: 'focus',
      });
    }

    if (['draft', 'tailored'].includes(job.status) && lastActivityAt(job) < staleCutoff) {
      actions.push({
        jobId: job.id,
        label: job.status === 'draft' ? 'Tailor draft' : 'Apply or archive',
        detail: `${job.role || 'Role'} at ${job.company || 'company'}`,
        tone: 'normal',
      });
    }
  }

  return actions.slice(0, 6);
}
