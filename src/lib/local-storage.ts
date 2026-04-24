import type { Resume, StashEntry, TailoredResume, CoverLetter, JobApplication, FitScore, InterviewStory, OutreachEmail } from '@/lib/types';

const KEYS = {
  resumes: 'rt-resumes',
  stash: 'rt-stash',
  tailored: 'rt-tailored',
  coverLetters: 'rt-cover-letters',
  jobs: 'rt-jobs',
  fitScores: 'rt-fit-scores',
  interviewStories: 'rt-interview-stories',
  outreachEmails: 'rt-outreach-emails',
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
  return getItems<Resume>(KEYS.resumes).find(r => r.id === id) ?? null;
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
  const idx = resumes.findIndex(r => r.id === id);
  if (idx >= 0) {
    resumes[idx].source = source;
    resumes[idx].updated_at = Math.floor(Date.now() / 1000);
    setItems(KEYS.resumes, resumes);
  }
}

export function localDeleteResume(id: string): void {
  setItems(KEYS.resumes, getItems<Resume>(KEYS.resumes).filter(r => r.id !== id));
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

export function localUpdateStashEntry(id: string, category: string, label: string, content: string): void {
  const entries = getItems<StashEntry>(KEYS.stash);
  const idx = entries.findIndex(e => e.id === id);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], category, label, content, updated_at: Math.floor(Date.now() / 1000) };
    setItems(KEYS.stash, entries);
  }
}

export function localDeleteStashEntry(id: string): void {
  setItems(KEYS.stash, getItems<StashEntry>(KEYS.stash).filter(e => e.id !== id));
}

// --- Job Applications (guest metadata) ---
interface LocalJob {
  id: string;
  company: string;
  role: string;
  resume_id: string;
  status: JobApplication['status'];
  created_at: number;
  updated_at?: number;
}

export function localListJobs(): Pick<JobApplication, 'id' | 'company' | 'role' | 'status' | 'created_at'>[] {
  return getItems<LocalJob>(KEYS.jobs).sort((a, b) => b.created_at - a.created_at);
}

export function localSaveJob(id: string, company: string, role: string, resumeId: string): void {
  const now = Math.floor(Date.now() / 1000);
  const jobs = getItems<LocalJob>(KEYS.jobs);
  jobs.push({ id, company, role, resume_id: resumeId, status: 'draft', created_at: now });
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

// --- Tailored Resumes ---
export function localGetTailoredResumes(jobId: string): TailoredResume[] {
  return getItems<TailoredResume>(KEYS.tailored).filter(t => t.job_id === jobId);
}

export function localSaveTailoredResume(jobId: string, resumeId: string, source: string): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<TailoredResume>(KEYS.tailored);
  items.push({ id, job_id: jobId, resume_id: resumeId, source, accepted: 0, created_at: now, updated_at: now });
  setItems(KEYS.tailored, items);
  return id;
}

// --- Cover Letters ---
export function localGetCoverLetter(jobId: string): CoverLetter | null {
  return getItems<CoverLetter>(KEYS.coverLetters).find(c => c.job_id === jobId) ?? null;
}

export function localSaveCoverLetter(jobId: string, resumeId: string, content: string, companyResearch: string): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<CoverLetter>(KEYS.coverLetters).filter(c => c.job_id !== jobId);
  items.push({ id, job_id: jobId, resume_id: resumeId, content, company_research: companyResearch, created_at: now, updated_at: now });
  setItems(KEYS.coverLetters, items);
  return id;
}

export function localUpdateCoverLetter(id: string, content: string): void {
  const items = getItems<CoverLetter>(KEYS.coverLetters);
  const idx = items.findIndex(c => c.id === id);
  if (idx >= 0) {
    items[idx].content = content;
    items[idx].updated_at = Math.floor(Date.now() / 1000);
    setItems(KEYS.coverLetters, items);
  }
}

// --- Fit Scores ---
export function localGetFitScore(jobId: string): FitScore | null {
  return getItems<FitScore>(KEYS.fitScores).find(f => f.job_id === jobId) ?? null;
}

export function localSaveFitScore(fitScore: FitScore): void {
  const items = getItems<FitScore>(KEYS.fitScores).filter(f => f.job_id !== fitScore.job_id);
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
  return getItems<InterviewStory>(KEYS.interviewStories).filter(s => s.job_id === jobId);
}

export function localSaveInterviewStories(stories: InterviewStory[]): void {
  if (stories.length === 0) return;
  const jobId = stories[0].job_id;
  const existing = getItems<InterviewStory>(KEYS.interviewStories).filter(s => s.job_id !== jobId);
  setItems(KEYS.interviewStories, [...existing, ...stories]);
}

// --- Outreach Emails ---
export function localGetOutreachEmail(jobId: string): OutreachEmail | null {
  return getItems<OutreachEmail>(KEYS.outreachEmails).find(o => o.job_id === jobId) ?? null;
}

export function localSaveOutreachEmail(jobId: string, resumeId: string, subject: string, body: string): string {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const items = getItems<OutreachEmail>(KEYS.outreachEmails).filter(o => o.job_id !== jobId);
  items.push({ id, job_id: jobId, resume_id: resumeId, subject, body, created_at: now });
  setItems(KEYS.outreachEmails, items);
  return id;
}
