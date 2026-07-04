import type {
  JobDiscoveryAlert,
  SavedJobSearch,
  SavedJobShortlistItem,
} from '@/lib/job-discovery-alerts';
import type { DiscoveredJob } from '@/lib/job-discovery-types';
import { buildApplyAgentReadiness, inferAtsProvider } from '@/lib/apply-agent';
import { buildProofItemsForJob } from '@/lib/achievement-evidence';
import type {
  AchievementEvidence,
  ApplicationPacket,
  ApplicationQueueEntry,
  ApplicationQueueStatus,
  ApplicationReceipt,
  ApplicationReceiptField,
  CoverLetter,
  FitScore,
  InterviewStory,
  JobApplication,
  JobDetailsPatch,
  OutreachEmail,
  ProfileAnswer,
  ProfileAnswerCategory,
  Resume,
  SkillsRoadmap,
  StashEntry,
  TailorChange,
  TailoredResume,
} from '@/lib/types';

const KEYS = {
  resumes: 'rt-resumes',
  stash: 'rt-stash',
  tailored: 'rt-tailored',
  coverLetters: 'rt-cover-letters',
  jobs: 'rt-jobs',
  fitScores: 'rt-fit-scores',
  interviewStories: 'rt-interview-stories',
  outreachEmails: 'rt-outreach-emails',
  skillsRoadmaps: 'rt-skills-roadmaps',
  achievementEvidence: 'rt-achievement-evidence',
  savedJobSearches: 'rt-saved-job-searches',
  savedJobShortlist: 'rt-saved-job-shortlist',
  jobDiscoveryAlerts: 'rt-job-discovery-alerts',
  applicationQueue: 'rt-application-queue',
  applicationReceipts: 'rt-application-receipts',
  profileAnswers: 'rt-profile-answers',
} as const;

function getItems<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function setItems<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

// --- Resumes ---
export function localListResumes(): Resume[] {
  return getItems<Resume>(KEYS.resumes).sort((a, b) => b.updated_at - a.updated_at);
}

export function localGetResume(id: string): Resume | null {
  return getItems<Resume>(KEYS.resumes).find((r) => r.id === id) ?? null;
}

export function localCreateResume(name: string, source: string): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const resumes = getItems<Resume>(KEYS.resumes);
  resumes.push({ id, name, source, created_at: now, updated_at: now });
  setItems(KEYS.resumes, resumes);
  return id;
}

export function localUpdateResume(id: string, source: string): void {
  const resumes = getItems<Resume>(KEYS.resumes);
  const idx = resumes.findIndex((r) => r.id === id);
  if (idx >= 0) {
    resumes[idx].source = source;
    resumes[idx].updated_at = Math.floor(Date.now() / 1000);
    setItems(KEYS.resumes, resumes);
  }
}

export function localRenameResume(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const resumes = getItems<Resume>(KEYS.resumes);
  const idx = resumes.findIndex((r) => r.id === id);
  if (idx >= 0) {
    resumes[idx].name = trimmed;
    resumes[idx].updated_at = Math.floor(Date.now() / 1000);
    setItems(KEYS.resumes, resumes);
  }
}

export function localDeleteResume(id: string): void {
  setItems(
    KEYS.resumes,
    getItems<Resume>(KEYS.resumes).filter((r) => r.id !== id)
  );
}

// --- Stash Entries ---
export function localListStashEntries(): StashEntry[] {
  return getItems<StashEntry>(KEYS.stash).sort((a, b) => b.updated_at - a.updated_at);
}

export function localCreateStashEntry(category: string, label: string, content: string): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const entries = getItems<StashEntry>(KEYS.stash);
  entries.push({ id, category, label, content, created_at: now, updated_at: now });
  setItems(KEYS.stash, entries);
  return id;
}

export function localUpdateStashEntry(
  id: string,
  category: string,
  label: string,
  content: string
): void {
  const entries = getItems<StashEntry>(KEYS.stash);
  const idx = entries.findIndex((e) => e.id === id);
  if (idx >= 0) {
    entries[idx] = {
      ...entries[idx],
      category,
      label,
      content,
      updated_at: Math.floor(Date.now() / 1000),
    };
    setItems(KEYS.stash, entries);
  }
}

export function localDeleteStashEntry(id: string): void {
  setItems(
    KEYS.stash,
    getItems<StashEntry>(KEYS.stash).filter((e) => e.id !== id)
  );
}

// --- Achievement Evidence ---
export function localListAchievementEvidence(): AchievementEvidence[] {
  return getItems<AchievementEvidence>(KEYS.achievementEvidence).sort(
    (a, b) => b.updated_at - a.updated_at
  );
}

export function localCreateAchievementEvidence(
  input: Omit<AchievementEvidence, 'id' | 'created_at' | 'updated_at'>
): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const entries = getItems<AchievementEvidence>(KEYS.achievementEvidence);
  entries.push({ ...input, id, created_at: now, updated_at: now });
  setItems(KEYS.achievementEvidence, entries);
  return id;
}

export function localUpdateAchievementEvidence(
  id: string,
  input: Omit<AchievementEvidence, 'id' | 'created_at' | 'updated_at'>
): void {
  const entries = getItems<AchievementEvidence>(KEYS.achievementEvidence);
  const idx = entries.findIndex((e) => e.id === id);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...input, updated_at: Math.floor(Date.now() / 1000) };
    setItems(KEYS.achievementEvidence, entries);
  }
}

export function localDeleteAchievementEvidence(id: string): void {
  setItems(
    KEYS.achievementEvidence,
    getItems<AchievementEvidence>(KEYS.achievementEvidence).filter((e) => e.id !== id)
  );
}

// --- Job discovery (guest) ---
export function localListSavedJobSearches(): SavedJobSearch[] {
  return getItems<SavedJobSearch>(KEYS.savedJobSearches).sort(
    (a, b) => b.updated_at - a.updated_at
  );
}

export function localCreateSavedJobSearch(
  input: Omit<SavedJobSearch, 'id' | 'created_at' | 'updated_at' | 'paused'> & { paused?: boolean }
): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<SavedJobSearch>(KEYS.savedJobSearches);
  items.push({
    id,
    name: input.name,
    query: input.query,
    location: input.location,
    remote: input.remote,
    paused: input.paused ?? false,
    last_run_at: input.last_run_at,
    created_at: now,
    updated_at: now,
  });
  setItems(KEYS.savedJobSearches, items);
  return id;
}

export function localUpdateSavedJobSearch(id: string, paused: boolean): void {
  const items = getItems<SavedJobSearch>(KEYS.savedJobSearches);
  const idx = items.findIndex((item) => item.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], paused, updated_at: Math.floor(Date.now() / 1000) };
    setItems(KEYS.savedJobSearches, items);
  }
}

export function localDeleteSavedJobSearch(id: string): void {
  setItems(
    KEYS.savedJobSearches,
    getItems<SavedJobSearch>(KEYS.savedJobSearches).filter((item) => item.id !== id)
  );
}

export function localListSavedJobShortlist(): SavedJobShortlistItem[] {
  return getItems<SavedJobShortlistItem>(KEYS.savedJobShortlist).sort(
    (a, b) => b.saved_at - a.saved_at
  );
}

export function localAddSavedJobShortlist(job: DiscoveredJob): void {
  if (!job.job_url) return;
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<SavedJobShortlistItem>(KEYS.savedJobShortlist).filter(
    (item) => item.job_url !== job.job_url
  );
  items.push({
    id: crypto.randomUUID(),
    job_id: job.id,
    title: job.title ?? 'Untitled role',
    company: job.company ?? 'Unknown company',
    job_url: job.job_url,
    location: job.location ?? undefined,
    saved_at: now,
    last_seen_at: now,
  });
  setItems(KEYS.savedJobShortlist, items);
}

export function localRemoveSavedJobShortlist(id: string): void {
  setItems(
    KEYS.savedJobShortlist,
    getItems<SavedJobShortlistItem>(KEYS.savedJobShortlist).filter((item) => item.id !== id)
  );
}

export function localListJobDiscoveryAlerts(): JobDiscoveryAlert[] {
  return getItems<JobDiscoveryAlert>(KEYS.jobDiscoveryAlerts).sort(
    (a, b) => b.created_at - a.created_at
  );
}

export function localAddJobDiscoveryAlert(
  alert: Omit<JobDiscoveryAlert, 'id' | 'created_at' | 'seen'>
): void {
  const items = getItems<JobDiscoveryAlert>(KEYS.jobDiscoveryAlerts);
  items.unshift({
    ...alert,
    id: crypto.randomUUID(),
    created_at: Math.floor(Date.now() / 1000),
    seen: false,
  });
  setItems(KEYS.jobDiscoveryAlerts, items.slice(0, 50));
}

export function localMarkJobDiscoveryAlertsSeen(): void {
  setItems(
    KEYS.jobDiscoveryAlerts,
    getItems<JobDiscoveryAlert>(KEYS.jobDiscoveryAlerts).map((alert) => ({ ...alert, seen: true }))
  );
}

// --- Job Applications (guest metadata) ---
interface LocalJob {
  id: string;
  resume_id: string;
  url?: string;
  company: string;
  role: string;
  jd_raw?: string;
  jd_text?: string;
  status: JobApplication['status'];
  created_at: number;
  updated_at?: number;
  interview_date?: number | null;
  follow_up_at?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  offer_amount?: number | null;
  notes?: string | null;
  rejection_reason?: string | null;
}

export type LocalJobSummary = Pick<
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

function toJobApplication(j: LocalJob): JobApplication {
  return {
    id: j.id,
    resume_id: j.resume_id,
    url: j.url ?? '',
    company: j.company,
    role: j.role,
    jd_raw: j.jd_raw ?? j.jd_text ?? '',
    jd_text: j.jd_text ?? j.jd_raw ?? '',
    status: j.status,
    interview_date: j.interview_date ?? null,
    follow_up_at: j.follow_up_at ?? null,
    salary_min: j.salary_min ?? null,
    salary_max: j.salary_max ?? null,
    salary_currency: j.salary_currency ?? null,
    offer_amount: j.offer_amount ?? null,
    notes: j.notes ?? null,
    rejection_reason: j.rejection_reason ?? null,
    created_at: j.created_at,
    updated_at: j.updated_at ?? j.created_at,
  };
}

function toSummary(j: LocalJob): LocalJobSummary {
  return {
    id: j.id,
    resume_id: j.resume_id,
    url: j.url ?? '',
    company: j.company,
    role: j.role,
    status: j.status,
    created_at: j.created_at,
    updated_at: j.updated_at ?? j.created_at,
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

export function localGetJob(id: string): JobApplication | null {
  const job = getItems<LocalJob>(KEYS.jobs).find((j) => j.id === id);
  return job ? toJobApplication(job) : null;
}

export function localListJobs(): LocalJobSummary[] {
  return getItems<LocalJob>(KEYS.jobs)
    .sort((a, b) => b.created_at - a.created_at)
    .map(toSummary);
}

export function localSaveJob(
  id: string,
  company: string,
  role: string,
  resumeId: string,
  url = '',
  jdRaw = '',
  jdText = ''
): void {
  const now = Math.floor(Date.now() / 1000);
  const jobs = getItems<LocalJob>(KEYS.jobs);
  jobs.push({
    id,
    company,
    role,
    resume_id: resumeId,
    url,
    jd_raw: jdRaw,
    jd_text: jdText,
    status: 'draft',
    created_at: now,
    updated_at: now,
  });
  setItems(KEYS.jobs, jobs);
}

export function localUpdateJobStatus(id: string, status: JobApplication['status']): void {
  const jobs = getItems<LocalJob>(KEYS.jobs);
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx >= 0) {
    jobs[idx].status = status;
    jobs[idx].updated_at = Math.floor(Date.now() / 1000);
    setItems(KEYS.jobs, jobs);
  }
}

export function localUpdateJobDetails(id: string, patch: JobDetailsPatch): void {
  const jobs = getItems<LocalJob>(KEYS.jobs);
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx >= 0) {
    jobs[idx] = { ...jobs[idx], ...patch, updated_at: Math.floor(Date.now() / 1000) };
    setItems(KEYS.jobs, jobs);
  }
}

// --- Tailored Resumes ---
export function localGetTailoredResumes(jobId: string): TailoredResume[] {
  return getItems<TailoredResume>(KEYS.tailored)
    .filter((t) => t.job_id === jobId)
    .map((t) => ({ ...t, changes: Array.isArray(t.changes) ? t.changes : [] }));
}

export function localSaveTailoredResume(
  jobId: string,
  resumeId: string,
  source: string,
  changes: TailorChange[] = []
): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<TailoredResume>(KEYS.tailored);
  items.push({
    id,
    job_id: jobId,
    resume_id: resumeId,
    source,
    accepted: 0,
    changes: changes ?? [],
    created_at: now,
    updated_at: now,
  });
  setItems(KEYS.tailored, items);
  return id;
}

// --- Cover Letters ---
export function localGetCoverLetter(jobId: string): CoverLetter | null {
  return getItems<CoverLetter>(KEYS.coverLetters).find((c) => c.job_id === jobId) ?? null;
}

export function localSaveCoverLetter(
  jobId: string,
  resumeId: string,
  content: string,
  companyResearch: string
): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<CoverLetter>(KEYS.coverLetters).filter((c) => c.job_id !== jobId);
  items.push({
    id,
    job_id: jobId,
    resume_id: resumeId,
    content,
    company_research: companyResearch,
    created_at: now,
    updated_at: now,
  });
  setItems(KEYS.coverLetters, items);
  return id;
}

export function localUpdateCoverLetter(id: string, content: string): void {
  const items = getItems<CoverLetter>(KEYS.coverLetters);
  const idx = items.findIndex((c) => c.id === id);
  if (idx >= 0) {
    items[idx].content = content;
    items[idx].updated_at = Math.floor(Date.now() / 1000);
    setItems(KEYS.coverLetters, items);
  }
}

function excerpt(value: string | null | undefined, max = 220): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}...` : cleaned;
}

function latestByCreated<T extends { created_at: number }>(items: T[]): T | null {
  return items.slice().sort((a, b) => b.created_at - a.created_at)[0] ?? null;
}

function localBuildReadiness(job: LocalJob) {
  return buildApplyAgentReadiness({
    jobStatus: job.status,
    hasResume: Boolean(job.resume_id),
    hasTailoredResume: job.status === 'tailored' || localGetTailoredResumes(job.id).length > 0,
    hasCoverLetter: Boolean(localGetCoverLetter(job.id)),
    hasProfileAnswers: localListProfileAnswers().length > 0,
    hasReceipt: localListApplicationReceipts([job.id]).length > 0,
  });
}

export function localListApplicationQueue(): ApplicationQueueEntry[] {
  return getItems<ApplicationQueueEntry>(KEYS.applicationQueue).sort(
    (a, b) => b.updated_at - a.updated_at
  );
}

export function localQueueApplication(jobId: string): ApplicationQueueEntry {
  const job = getItems<LocalJob>(KEYS.jobs).find((item) => item.id === jobId);
  if (!job) throw new Error('Job not found');
  const now = Math.floor(Date.now() / 1000);
  const queue = getItems<ApplicationQueueEntry>(KEYS.applicationQueue);
  const existingIdx = queue.findIndex((entry) => entry.job_id === jobId);
  const entry: ApplicationQueueEntry = {
    id: existingIdx >= 0 ? queue[existingIdx].id : crypto.randomUUID(),
    job_id: jobId,
    status: existingIdx >= 0 ? queue[existingIdx].status : 'queued',
    readiness: localBuildReadiness(job),
    created_at: existingIdx >= 0 ? queue[existingIdx].created_at : now,
    updated_at: now,
  };
  if (existingIdx >= 0) queue[existingIdx] = entry;
  else queue.push(entry);
  setItems(KEYS.applicationQueue, queue);
  return entry;
}

export function localRefreshApplicationQueueReadiness(): ApplicationQueueEntry[] {
  const jobs = getItems<LocalJob>(KEYS.jobs);
  const now = Math.floor(Date.now() / 1000);
  const queue = getItems<ApplicationQueueEntry>(KEYS.applicationQueue).map((entry) => {
    const job = jobs.find((item) => item.id === entry.job_id);
    return job ? { ...entry, readiness: localBuildReadiness(job), updated_at: now } : entry;
  });
  setItems(KEYS.applicationQueue, queue);
  return localListApplicationQueue();
}

export function localUpdateApplicationQueueStatus(
  queueId: string,
  status: ApplicationQueueStatus
): void {
  const queue = getItems<ApplicationQueueEntry>(KEYS.applicationQueue);
  const idx = queue.findIndex((entry) => entry.id === queueId);
  if (idx >= 0) {
    queue[idx] = { ...queue[idx], status, updated_at: Math.floor(Date.now() / 1000) };
    setItems(KEYS.applicationQueue, queue);
  }
}

export function localBulkUpdateApplicationQueueStatus(
  queueIds: string[],
  status: ApplicationQueueStatus
): ApplicationQueueEntry[] {
  const allowed = new Set(queueIds);
  const now = Math.floor(Date.now() / 1000);
  const queue = getItems<ApplicationQueueEntry>(KEYS.applicationQueue).map((entry) =>
    allowed.has(entry.id) ? { ...entry, status, updated_at: now } : entry
  );
  setItems(KEYS.applicationQueue, queue);
  return localListApplicationQueue().filter((entry) => allowed.has(entry.id));
}

export function localRetryApplicationQueueEntry(queueId: string): ApplicationQueueEntry {
  const jobs = getItems<LocalJob>(KEYS.jobs);
  const queue = getItems<ApplicationQueueEntry>(KEYS.applicationQueue);
  const idx = queue.findIndex((entry) => entry.id === queueId);
  if (idx < 0) throw new Error('Queued application not found');
  if (queue[idx].status === 'submitted')
    throw new Error('Submitted applications cannot be retried');
  const job = jobs.find((item) => item.id === queue[idx].job_id);
  if (!job) throw new Error('Job not found');
  const readiness = localBuildReadiness(job);
  if (readiness.status === 'submitted') throw new Error('Submitted applications cannot be retried');
  const status: ApplicationQueueStatus =
    readiness.status === 'ready_for_review' ? 'ready_to_submit' : 'needs_user';
  const entry = {
    ...queue[idx],
    status,
    readiness,
    updated_at: Math.floor(Date.now() / 1000),
  };
  queue[idx] = entry;
  setItems(KEYS.applicationQueue, queue);
  return entry;
}

export function localListApplicationReceipts(jobIds?: string[]): ApplicationReceipt[] {
  const allowed = jobIds && jobIds.length > 0 ? new Set(jobIds) : null;
  return getItems<ApplicationReceipt>(KEYS.applicationReceipts)
    .filter((receipt) => !allowed || allowed.has(receipt.job_id))
    .sort((a, b) => b.created_at - a.created_at);
}

export function localRecordManualApplicationReceipt(queueId: string): ApplicationReceipt | null {
  const queue = getItems<ApplicationQueueEntry>(KEYS.applicationQueue);
  const queueIdx = queue.findIndex((entry) => entry.id === queueId);
  if (queueIdx < 0) return null;
  const entry = queue[queueIdx];
  const jobs = getItems<LocalJob>(KEYS.jobs);
  const jobIdx = jobs.findIndex((job) => job.id === entry.job_id);
  if (jobIdx < 0) return null;
  const job = jobs[jobIdx];
  const coverLetter = localGetCoverLetter(job.id);
  const proofItems = buildProofItemsForJob(
    localListAchievementEvidence(),
    job.role,
    job.jd_text ?? job.jd_raw ?? '',
    4
  );
  const now = Math.floor(Date.now() / 1000);
  const fields: ApplicationReceiptField[] = [
    { label: 'Submission mode', value: 'Manual confirmation', source: 'user' },
    { label: 'Readiness at submission', value: entry.readiness.summary, source: 'system' },
    ...localListProfileAnswers().map<ApplicationReceiptField>((answer) => ({
      label: answer.label,
      value: answer.answer,
      source: 'profile',
    })),
    ...(proofItems.length > 0
      ? [
          {
            label: 'Proof review boundary',
            value:
              'Proof candidates were available for review; RolePatch did not automatically share them.',
            source: 'system' as const,
          },
          {
            label: 'Proof candidates available',
            value: String(proofItems.length),
            source: 'system' as const,
          },
          ...proofItems.map<ApplicationReceiptField>((item) => ({
            label: 'Proof candidate',
            value: `${item.title}: ${item.claim}${item.source_url ? ` Source: ${item.source_url}` : ''}`,
            source: 'system',
          })),
        ]
      : []),
  ];
  const receipt: ApplicationReceipt = {
    id: crypto.randomUUID(),
    job_id: job.id,
    queue_id: entry.id,
    provider: inferAtsProvider(job.url ?? ''),
    status: 'submitted',
    fields,
    resume_id: job.resume_id,
    cover_letter_id: coverLetter?.id ?? null,
    confirmation_text: 'Marked submitted manually in RolePatch.',
    confirmation_url: null,
    failure_reason: null,
    created_at: now,
  };
  const receipts = getItems<ApplicationReceipt>(KEYS.applicationReceipts);
  receipts.push(receipt);
  setItems(KEYS.applicationReceipts, receipts);

  jobs[jobIdx] = { ...job, status: 'applied', updated_at: now };
  setItems(KEYS.jobs, jobs);
  queue[queueIdx] = {
    ...entry,
    status: 'submitted',
    readiness: localBuildReadiness(jobs[jobIdx]),
    updated_at: now,
  };
  setItems(KEYS.applicationQueue, queue);
  return receipt;
}

export function localListProfileAnswers(): ProfileAnswer[] {
  return getItems<ProfileAnswer>(KEYS.profileAnswers).sort((a, b) => b.updated_at - a.updated_at);
}

export function localSaveProfileAnswer(input: {
  id?: string;
  category: ProfileAnswerCategory;
  label: string;
  answer: string;
  sensitive: boolean;
}): ProfileAnswer {
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<ProfileAnswer>(KEYS.profileAnswers);
  const existing = input.id ? items.find((answer) => answer.id === input.id) : undefined;
  const answer: ProfileAnswer = {
    id: existing?.id ?? crypto.randomUUID(),
    category: input.category,
    label: input.label.trim(),
    answer: input.answer.trim(),
    sensitive: input.sensitive,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  setItems(
    KEYS.profileAnswers,
    existing ? items.map((item) => (item.id === existing.id ? answer : item)) : [...items, answer]
  );
  return answer;
}

export function localDeleteProfileAnswer(id: string): void {
  setItems(
    KEYS.profileAnswers,
    getItems<ProfileAnswer>(KEYS.profileAnswers).filter((answer) => answer.id !== id)
  );
}

export function localListApplicationPackets(jobIds?: string[]): ApplicationPacket[] {
  const allowed = jobIds && jobIds.length > 0 ? new Set(jobIds) : null;
  const receipts = localListApplicationReceipts();
  const profileAnswers = localListProfileAnswers();
  const evidenceEntries = localListAchievementEvidence();
  return getItems<LocalJob>(KEYS.jobs)
    .filter((job) => !allowed || allowed.has(job.id))
    .map((job) => {
      const resume = localGetResume(job.resume_id);
      const tailored = latestByCreated(localGetTailoredResumes(job.id));
      const coverLetter = localGetCoverLetter(job.id);
      const proofItems = buildProofItemsForJob(
        evidenceEntries,
        job.role,
        job.jd_text ?? job.jd_raw ?? '',
        4
      ).map((item) => ({
        id: item.id,
        title: item.title,
        claim: item.claim,
        readiness: item.readiness.label,
        missing: item.readiness.missing,
        tags: item.tags,
        source_url: item.source_url,
      }));
      return {
        job_id: job.id,
        ats_url: job.url ?? '',
        ats_provider: inferAtsProvider(job.url ?? ''),
        resume_id: job.resume_id,
        resume_name: resume?.name ?? null,
        tailored_resume_id: tailored?.id ?? null,
        tailored_excerpt: excerpt(tailored?.source),
        cover_letter_id: coverLetter?.id ?? null,
        cover_letter_excerpt: excerpt(coverLetter?.content),
        profile_answers: profileAnswers,
        proof_items: proofItems,
        receipt: receipts.find((receipt) => receipt.job_id === job.id) ?? null,
      };
    });
}

// --- Fit Scores ---
export function localGetFitScore(jobId: string): FitScore | null {
  return getItems<FitScore>(KEYS.fitScores).find((f) => f.job_id === jobId) ?? null;
}

export function localSaveFitScore(fitScore: FitScore): void {
  const items = getItems<FitScore>(KEYS.fitScores).filter((f) => f.job_id !== fitScore.job_id);
  items.push(fitScore);
  setItems(KEYS.fitScores, items);
}

export function localListFitScores(): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const f of getItems<FitScore>(KEYS.fitScores)) {
    scores[f.job_id] = f.overall_score;
  }
  return scores;
}

// --- Interview Stories ---
export function localGetInterviewStories(jobId: string): InterviewStory[] {
  return getItems<InterviewStory>(KEYS.interviewStories).filter((s) => s.job_id === jobId);
}

export function localSaveInterviewStories(stories: InterviewStory[]): void {
  if (stories.length === 0) return;
  const existing = getItems<InterviewStory>(KEYS.interviewStories);
  const incomingJobIds = new Set(stories.map((story) => story.job_id));
  const preserved = existing.filter((story) => !incomingJobIds.has(story.job_id));
  setItems(KEYS.interviewStories, [...preserved, ...stories]);
}

// --- Outreach Emails ---
export function localGetOutreachEmail(jobId: string): OutreachEmail | null {
  return getItems<OutreachEmail>(KEYS.outreachEmails).find((o) => o.job_id === jobId) ?? null;
}

export function localSaveOutreachEmail(
  jobId: string,
  resumeId: string,
  subject: string,
  body: string
): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<OutreachEmail>(KEYS.outreachEmails).filter((o) => o.job_id !== jobId);
  items.push({ id, job_id: jobId, resume_id: resumeId, subject, body, created_at: now });
  setItems(KEYS.outreachEmails, items);
  return id;
}

// --- Skills Roadmaps ---
export function localGetSkillsRoadmap(jobId: string): SkillsRoadmap | null {
  return getItems<SkillsRoadmap>(KEYS.skillsRoadmaps).find((r) => r.job_id === jobId) ?? null;
}

export function localSaveSkillsRoadmap(roadmap: SkillsRoadmap): void {
  const items = getItems<SkillsRoadmap>(KEYS.skillsRoadmaps).filter(
    (r) => r.job_id !== roadmap.job_id
  );
  items.push(roadmap);
  setItems(KEYS.skillsRoadmaps, items);
}
