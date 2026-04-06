'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { migrateGuestData } from '@/lib/actions/migration-actions';
import { localListResumes, localListJobs, localListStashEntries } from '@/lib/local-storage';
import type { Resume, JobApplication, TailoredResume, CoverLetter, StashEntry } from '@/lib/types';

const DISMISSED_KEY = 'rt-migration-dismissed';
const STORAGE_KEYS = ['rt-resumes', 'rt-jobs', 'rt-stash', 'rt-tailored', 'rt-cover-letters'];

function getLocalItems<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

export function MigrationBanner() {
  const { isGuest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(DISMISSED_KEY) === '1'
  );

  const resumes = !isGuest && !dismissed ? localListResumes() : [];
  const jobs = !isGuest && !dismissed ? localListJobs() : [];
  const stash = !isGuest && !dismissed ? localListStashEntries() : [];
  const total = resumes.length + jobs.length + stash.length;
  const visible = !isGuest && !dismissed && total > 0;

  if (!visible) return null;

  const parts: string[] = [];
  if (resumes.length > 0) parts.push(`${resumes.length} resume${resumes.length > 1 ? 's' : ''}`);
  if (jobs.length > 0) parts.push(`${jobs.length} job${jobs.length > 1 ? 's' : ''}`);
  if (stash.length > 0) parts.push(`${stash.length} stash entr${stash.length > 1 ? 'ies' : 'y'}`);

  async function handleImport() {
    setLoading(true);
    try {
      const resumes = getLocalItems<Resume>('rt-resumes');
      const jobs = getLocalItems<JobApplication>('rt-jobs');
      const tailoredResumes = getLocalItems<TailoredResume>('rt-tailored');
      const coverLetters = getLocalItems<CoverLetter>('rt-cover-letters');
      const stashEntries = getLocalItems<StashEntry>('rt-stash');

      const result = await migrateGuestData({ resumes, jobs, tailoredResumes, coverLetters, stashEntries });

      if (result.success) {
        STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
        window.location.reload();
      } else {
        console.error('Migration failed:', result.error);
        setLoading(false);
      }
    } catch (err) {
      console.error('Migration error:', err);
      setLoading(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <p className="text-sm text-foreground">
        We found {parts.join(', ')} saved locally. Import them to your account?
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleImport}
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Importing...' : 'Import'}
        </button>
        <button
          onClick={handleDismiss}
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-[var(--border)] text-foreground hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
