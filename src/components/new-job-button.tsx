'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { createJobApplication } from '@/lib/actions/job-actions';
import { scrapeJobUrl } from '@/lib/actions/scrape-action';
import { localListResumes, localSaveJob } from '@/lib/local-storage';

interface NewJobButtonProps {
  resumes: { id: string; name: string }[];
}

export function NewJobButton({ resumes: serverResumes }: NewJobButtonProps) {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [resumes, setResumes] = useState(serverResumes);
  const [open, setOpen] = useState(false);
  const [resumeId, setResumeId] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // For guests, supplement with localStorage resumes
  useEffect(() => {
    if (isGuest) {
      const localResumes = localListResumes().map((r) => ({ id: r.id, name: r.name }));
      setResumes(localResumes);
    }
  }, [isGuest]);

  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
    setUrl('');
    setError('');
  }, [loading]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  function handleOpen() {
    if (resumes.length === 0) {
      setToast('Create a resume first before adding a job.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    setResumeId(resumes[0].id);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !resumeId) return;

    setLoading(true);
    setError('');
    try {
      const scraped = await scrapeJobUrl(trimmedUrl);
      const jobId = await createJobApplication(
        resumeId,
        trimmedUrl,
        scraped.company,
        scraped.role,
        scraped.html,
        scraped.text
      );
      // For guests, also save job metadata in localStorage
      if (isGuest) {
        localSaveJob(jobId, scraped.company, scraped.role, resumeId);
      }
      close();
      router.push(`/tailor/${jobId}`);
    } catch (err) {
      setError(`Failed to scrape job: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] hover:border-[var(--muted-foreground)] transition-colors"
      >
        + Add Job
      </button>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 modal-backdrop" onClick={close} />
          <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 modal-content">
            <h2 className="text-lg font-semibold mb-5">Add Job Application</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {resumes.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                    Resume
                  </label>
                  <select
                    value={resumeId}
                    onChange={(e) => setResumeId(e.target.value)}
                    className="input-base"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Job URL
                </label>
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://boards.greenhouse.io/..."
                  className="input-base"
                />
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Scraping...' : 'Add Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
