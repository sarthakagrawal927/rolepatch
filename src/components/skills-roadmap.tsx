'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { useAuth } from '@/components/auth-provider';
import { generateSkillsRoadmap, getSkillsRoadmap } from '@/lib/actions/skills-roadmap-action';
import { localGetSkillsRoadmap, localSaveSkillsRoadmap } from '@/lib/local-storage';
import type { JobApplication, Resume, SkillPriority, SkillsRoadmap } from '@/lib/types';

const PRIORITY_ORDER: SkillPriority[] = ['high', 'medium', 'low'];

const PRIORITY_STYLE: Record<
  SkillPriority,
  { text: string; bg: string; border: string; label: string }
> = {
  high: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'High',
  },
  medium: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    label: 'Medium',
  },
  low: {
    text: 'text-[var(--muted-foreground)]',
    bg: 'bg-muted/20',
    border: 'border-[var(--border)]/60',
    label: 'Low',
  },
};

function progressKey(jobId: string) {
  return `rt-skills-progress-${jobId}`;
}

function loadProgress(jobId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(progressKey(jobId)) ?? '{}');
  } catch {
    return {};
  }
}

function saveProgress(jobId: string, progress: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(progressKey(jobId), JSON.stringify(progress));
}

interface SkillsRoadmapProps {
  job: JobApplication;
  resume: Resume | null;
}

export function SkillsRoadmapPanel({ job, resume }: SkillsRoadmapProps) {
  const { isGuest } = useAuth();
  const [roadmap, setRoadmap] = useState<SkillsRoadmap | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Load existing roadmap + progress
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = isGuest ? localGetSkillsRoadmap(job.id) : await getSkillsRoadmap(job.id);
      if (!cancelled && existing) setRoadmap(existing);
      if (!cancelled) setProgress(loadProgress(job.id));
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job.id, isGuest]);

  function toggleDone(key: string) {
    setProgress((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveProgress(job.id, next);
      return next;
    });
  }

  function handleGenerate() {
    if (!resume) return;
    setError(null);
    startTransition(async () => {
      try {
        const settings = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
        const aiConfig = {
          endpointUrl: settings.endpointUrl || '',
          apiKey: settings.apiKey || '',
          model: settings.model || '',
        };
        const result = await generateSkillsRoadmap(resume.source, job.jd_text, job.id, aiConfig);
        setRoadmap(result);
        if (isGuest) localSaveSkillsRoadmap(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate roadmap';
        setError(msg);
      }
    });
  }

  const grouped = useMemo(() => {
    if (!roadmap) return {} as Record<SkillPriority, SkillsRoadmap['items']>;
    const out: Record<SkillPriority, SkillsRoadmap['items']> = { high: [], medium: [], low: [] };
    for (const item of roadmap.items) out[item.priority].push(item);
    return out;
  }, [roadmap]);

  const completedCount = useMemo(
    () => (roadmap ? roadmap.items.filter((i) => progress[i.skill]).length : 0),
    [roadmap, progress]
  );

  return (
    <div className="space-y-5">
      {/* Header / CTA */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold">Skills Gap Roadmap</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            A prioritized plan of what to learn to close the gap for this role.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending || !resume}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] disabled:opacity-40 transition-colors shrink-0"
        >
          {isPending ? 'Planning...' : roadmap ? 'Regenerate' : 'Plan my learning'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          {error.includes('No tokens remaining') && (
            <Link
              href="/pricing"
              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 underline ml-3"
            >
              Buy more tokens
            </Link>
          )}
        </div>
      )}

      {roadmap ? (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-[var(--primary)] uppercase tracking-widest">
                Overview
              </p>
              <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                <span>
                  <span className="font-black text-foreground">
                    {roadmap.total_estimated_hours}
                  </span>{' '}
                  hrs
                </span>
                <span>
                  <span className="font-black text-foreground">
                    {completedCount}/{roadmap.items.length}
                  </span>{' '}
                  done
                </span>
              </div>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{roadmap.summary}</p>
          </div>

          {/* Grouped items by priority */}
          {PRIORITY_ORDER.map((priority) => {
            const items = grouped[priority];
            if (!items || items.length === 0) return null;
            const style = PRIORITY_STYLE[priority];
            return (
              <div key={priority} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest ${style.text}`}
                  >
                    {style.label} priority
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)] opacity-50">
                    {items.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const done = !!progress[item.skill];
                    return (
                      <li
                        key={item.skill}
                        className={`rounded-xl border ${style.border} ${
                          done ? 'bg-muted/30 opacity-60' : 'bg-[var(--card)]'
                        } p-4`}
                      >
                        <div className="flex items-start gap-3">
                          <label className="flex items-center pt-0.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={done}
                              onChange={() => toggleDone(item.skill)}
                              className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                              aria-label={`Mark ${item.skill} as done`}
                            />
                          </label>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4
                                className={`text-sm font-bold text-foreground ${
                                  done ? 'line-through' : ''
                                }`}
                              >
                                {item.skill}
                              </h4>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${style.border} ${style.bg} ${style.text} uppercase tracking-wider`}
                              >
                                {style.label}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                              {item.reason}
                            </p>

                            {/* Resources */}
                            {item.resources.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {item.resources.map((r, idx) => {
                                  const label = `${r.title}${r.estimated_hours ? ` • ${r.estimated_hours}h` : ''}`;
                                  const cls =
                                    'inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-muted/40 text-[var(--muted-foreground)] border border-[var(--border)]/50 hover:bg-muted/60 transition-colors';
                                  return r.url ? (
                                    <a
                                      key={`${r.title}-${idx}`}
                                      href={r.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cls}
                                    >
                                      <span className="opacity-60">[{r.type}]</span> {label}
                                    </a>
                                  ) : (
                                    <span key={`${r.title}-${idx}`} className={cls}>
                                      <span className="opacity-60">[{r.type}]</span> {label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Milestone */}
                            <p className="text-[11px] italic text-[var(--muted-foreground)] opacity-70 leading-snug">
                              Milestone: {item.milestone}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : !isPending ? (
        <div className="border border-dashed border-[var(--border)] rounded-2xl py-10 flex flex-col items-center justify-center bg-muted/20">
          <p className="text-sm font-bold text-foreground">No learning plan yet</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 px-6 text-center">
            Generate a prioritized list of skills to learn and resources to use — grounded in this
            job description.
          </p>
        </div>
      ) : null}
    </div>
  );
}
