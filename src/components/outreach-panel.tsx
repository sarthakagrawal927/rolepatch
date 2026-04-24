'use client';

import { useState, useEffect, useTransition } from 'react';
import type { JobApplication, Resume, OutreachEmail } from '@/lib/types';
import { generateOutreachEmail } from '@/lib/actions/outreach-action';
import { useAuth } from '@/components/auth-provider';
import {
  localGetResume,
  localGetOutreachEmail,
  localSaveOutreachEmail,
} from '@/lib/local-storage';
import { linkedinSearchUrl, hiringManagerSearchUrl } from '@/lib/linkedin-search';

interface OutreachPanelProps {
  job: JobApplication;
  serverResume: Resume | null;
  existingEmail: OutreachEmail | null;
}

export function OutreachPanel({ job, serverResume, existingEmail }: OutreachPanelProps) {
  const { isGuest } = useAuth();
  const [resume, setResume] = useState<Resume | null>(serverResume);
  const [subject, setSubject] = useState(existingEmail?.subject ?? '');
  const [body, setBody] = useState(existingEmail?.body ?? '');
  const [generating, setGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null);

  useEffect(() => {
    if (isGuest) {
      if (!serverResume) {
        const local = localGetResume(job.resume_id);
        if (local) setResume(local);
      }
      if (!existingEmail) {
        const localEmail = localGetOutreachEmail(job.id);
        if (localEmail) {
          setSubject(localEmail.subject);
          setBody(localEmail.body);
        }
      }
    }
  }, [isGuest, serverResume, existingEmail, job.resume_id, job.id]);

  function handleGenerate() {
    if (!resume) return;
    if (isGuest) {
      setError('Sign in to draft outreach emails.');
      return;
    }
    setError(null);
    setGenerating(true);
    startTransition(async () => {
      try {
        const settings = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
        const aiConfig = {
          endpointUrl: settings.endpointUrl || '',
          apiKey: settings.apiKey || '',
          model: settings.model || '',
        };
        const result = await generateOutreachEmail(
          resume.source,
          {
            id: job.id,
            resume_id: resume.id,
            company: job.company,
            role: job.role,
            jd_text: job.jd_text,
          },
          aiConfig,
        );
        setSubject(result.subject);
        setBody(result.body);
        if (isGuest) {
          localSaveOutreachEmail(job.id, resume.id, result.subject, result.body);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to draft outreach email');
      } finally {
        setGenerating(false);
      }
    });
  }

  async function copy(kind: 'subject' | 'body', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unsupported — noop */
    }
  }

  const isLoading = generating || isPending;
  const hasDraft = Boolean(subject || body);

  return (
    <section className="space-y-5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
      <header>
        <h2 className="text-lg font-semibold text-[var(--card-foreground)]">Recruiter outreach</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Draft a short cold email and find the right person to send it to.
        </p>
      </header>

      {error && (
        <div className="rounded border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !resume}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-40"
        >
          {generating ? 'Drafting…' : hasDraft ? 'Redraft outreach email' : 'Draft outreach email'}
        </button>
      </div>

      {hasDraft && (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Subject
              </label>
              <button
                type="button"
                onClick={() => copy('subject', subject)}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {copied === 'subject' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                Body
              </label>
              <button
                type="button"
                onClick={() => copy('body', body)}
                className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {copied === 'body' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Find a human
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={linkedinSearchUrl(job.company)}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            Find recruiters at {job.company || 'this company'}
          </a>
          <a
            href={hiringManagerSearchUrl(job.company, job.role)}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
          >
            Find hiring manager for {job.role || 'this role'}
          </a>
        </div>
      </div>
    </section>
  );
}
