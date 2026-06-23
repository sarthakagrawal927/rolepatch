'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  type CoverLetterLength,
  type CoverLetterTone,
  generateCoverLetter,
  updateCoverLetter,
} from '@/lib/actions/cover-letter-action';
import {
  localGetCoverLetter,
  localGetResume,
  localSaveCoverLetter,
  localUpdateCoverLetter,
} from '@/lib/local-storage';
import type { CoverLetter, JobApplication, Resume } from '@/lib/types';

interface CoverLetterEditorProps {
  job: JobApplication;
  serverResume: Resume | null;
  existingLetter: CoverLetter | null;
}

const PREFS_KEY = 'rt-cover-letter-prefs';

const TONE_OPTIONS: { value: CoverLetterTone; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'enthusiastic', label: 'Enthusiastic' },
];

const LENGTH_OPTIONS: { value: CoverLetterLength; label: string; hint: string }[] = [
  { value: 'short', label: 'Short', hint: '~150w' },
  { value: 'medium', label: 'Medium', hint: '~250w' },
  { value: 'long', label: 'Long', hint: '~400w' },
];

interface Prefs {
  tone: CoverLetterTone;
  length: CoverLetterLength;
}

const DEFAULT_PREFS: Prefs = { tone: 'conversational', length: 'medium' };

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      tone: TONE_OPTIONS.some((t) => t.value === parsed.tone)
        ? (parsed.tone as CoverLetterTone)
        : DEFAULT_PREFS.tone,
      length: LENGTH_OPTIONS.some((l) => l.value === parsed.length)
        ? (parsed.length as CoverLetterLength)
        : DEFAULT_PREFS.length,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

export function CoverLetterEditor({ job, serverResume, existingLetter }: CoverLetterEditorProps) {
  const { isGuest } = useAuth();
  const [resume, setResume] = useState<Resume | null>(serverResume);
  const [content, setContent] = useState(existingLetter?.content ?? '');
  const [letterId, setLetterId] = useState(existingLetter?.id ?? '');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [tone, setTone] = useState<CoverLetterTone>(DEFAULT_PREFS.tone);
  const [length, setLength] = useState<CoverLetterLength>(DEFAULT_PREFS.length);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Load persisted prefs once on client
  useEffect(() => {
    const p = loadPrefs();
    setTone(p.tone);
    setLength(p.length);
    setPrefsLoaded(true);
  }, []);

  // Persist prefs whenever they change (after initial load)
  useEffect(() => {
    if (!prefsLoaded) return;
    savePrefs({ tone, length });
  }, [tone, length, prefsLoaded]);

  // Guest: resolve resume and existing cover letter from localStorage
  useEffect(() => {
    if (isGuest) {
      if (!serverResume) {
        const local = localGetResume(job.resume_id);
        if (local) setResume(local);
      }
      if (!existingLetter) {
        const localLetter = localGetCoverLetter(job.id);
        if (localLetter) {
          setContent(localLetter.content);
          setLetterId(localLetter.id);
        }
      }
    }
  }, [isGuest, serverResume, existingLetter, job.resume_id, job.id]);

  function runGenerate(opts: { userFeedback?: string; previousDraft?: string }) {
    if (!resume) return;
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
        const result = await generateCoverLetter(
          resume.source,
          job.jd_text,
          job.company,
          job.id,
          resume.id,
          aiConfig,
          {
            tone,
            length,
            userFeedback: opts.userFeedback,
            previousDraft: opts.previousDraft,
          }
        );
        setContent(result);
        if (isGuest) {
          const id = localSaveCoverLetter(job.id, resume.id, result, '');
          setLetterId(id);
        } else {
          setLetterId('');
        }
        setShowFeedback(false);
        setFeedback('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate cover letter');
      } finally {
        setGenerating(false);
      }
    });
  }

  function handleGenerate() {
    runGenerate({});
  }

  function handleRegenerateWithFeedback() {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    runGenerate({ userFeedback: trimmed, previousDraft: content });
  }

  function handleSave() {
    if (!content || !letterId) return;
    setSaving(true);
    setSaveMessage(null);
    startTransition(async () => {
      try {
        if (isGuest) {
          localUpdateCoverLetter(letterId, content);
        } else {
          await updateCoverLetter(letterId, content);
        }
        setSaveMessage('Saved!');
        setTimeout(() => setSaveMessage(null), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save cover letter');
      } finally {
        setSaving(false);
      }
    });
  }

  const isLoading = generating || saving || isPending;

  if (!resume) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
        Resume not found. It may have been deleted.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="px-4 py-2 rounded text-sm border"
          style={{
            background: 'color-mix(in oklch, var(--destructive) 12%, transparent)',
            borderColor: 'color-mix(in oklch, var(--destructive) 40%, transparent)',
            color: 'var(--destructive)',
          }}
        >
          {error}
        </div>
      )}

      {/* Controls: tone + length segmented buttons */}
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedGroup
          label="Tone"
          value={tone}
          options={TONE_OPTIONS}
          onChange={setTone}
          disabled={isLoading}
        />
        <SegmentedGroup
          label="Length"
          value={length}
          options={LENGTH_OPTIONS}
          onChange={setLength}
          disabled={isLoading}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          {generating ? 'Generating...' : content ? 'Regenerate' : 'Generate Cover Letter'}
        </button>

        {content && (
          <button
            onClick={() => setShowFeedback((v) => !v)}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 border"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              background: 'transparent',
            }}
          >
            {showFeedback ? 'Cancel feedback' : 'Regenerate with feedback'}
          </button>
        )}

        {content && letterId && (
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
              background: 'transparent',
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}

        {saveMessage && <span className="text-sm text-[var(--accent)]">{saveMessage}</span>}

        <Link
          href={`/tailor/${job.id}`}
          className="ml-auto text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          Back to Tailor
        </Link>
      </div>

      {/* Feedback textarea */}
      {showFeedback && (
        <div className="space-y-2">
          <label
            htmlFor="cover-letter-feedback"
            className="block text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide"
          >
            What should change?
          </label>
          <textarea
            id="cover-letter-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Shorten the opening, emphasize my experience with distributed systems, tone down the buzzwords."
            className="w-full h-28 px-4 py-3 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleRegenerateWithFeedback}
              disabled={isLoading || !feedback.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-foreground)',
              }}
            >
              {generating ? 'Regenerating...' : 'Apply feedback'}
            </button>
            <span className="text-xs text-[var(--muted-foreground)]">
              Uses your current draft as context.
            </span>
          </div>
        </div>
      )}

      {/* Cover letter textarea */}
      {content ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-[60vh] px-6 py-5 rounded-lg border bg-transparent text-base leading-relaxed font-serif resize-none focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        />
      ) : (
        <div
          className="w-full h-[60vh] flex items-center justify-center rounded-lg border border-dashed text-sm"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
          }}
        >
          Click &quot;Generate Cover Letter&quot; to get started
        </div>
      )}
    </div>
  );
}

interface SegmentedGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

function SegmentedGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: SegmentedGroupProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              className="px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-inset"
              style={{
                background: active ? 'var(--secondary)' : 'transparent',
                color: active ? 'var(--secondary-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {opt.label}
              {opt.hint && <span className="ml-1 text-[10px] opacity-70">{opt.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
