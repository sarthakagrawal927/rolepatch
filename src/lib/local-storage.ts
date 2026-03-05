import type { Resume, StashEntry, TailoredResume, CoverLetter, JobApplication } from '@/lib/types';

const KEYS = {
  resumes: 'rt-resumes',
  stash: 'rt-stash',
  tailored: 'rt-tailored',
  coverLetters: 'rt-cover-letters',
  jobs: 'rt-jobs',
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
export function localListJobs(): Pick<JobApplication, 'id' | 'company' | 'role' | 'status' | 'created_at'>[] {
  return getItems<any>(KEYS.jobs).sort((a: any, b: any) => b.created_at - a.created_at);
}

export function localSaveJob(id: string, company: string, role: string, resumeId: string): void {
  const now = Math.floor(Date.now() / 1000);
  const jobs = getItems<any>(KEYS.jobs);
  jobs.push({ id, company, role, resume_id: resumeId, status: 'draft', created_at: now });
  setItems(KEYS.jobs, jobs);
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
