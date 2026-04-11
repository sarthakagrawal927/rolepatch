'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { JobApplication, Resume, InterviewStory } from '@/lib/types';
import { generateInterviewStories } from '@/lib/actions/interview-prep-action';
import { useAuth } from '@/components/auth-provider';

interface InterviewPrepProps {
  job: JobApplication;
  resume: Resume | null;
  existingStories: InterviewStory[];
}

function StoryCard({ story, index }: { story: InterviewStory; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[var(--card)] border border-[var(--border)]/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-start gap-4 text-left hover:bg-muted/10 transition-colors"
      >
        <span className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-xs font-black text-[var(--primary)] shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm">{story.theme}</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-1 opacity-70">
            {story.jd_requirement}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform mt-1 shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-[var(--border)]/30">
          {/* JD Requirement */}
          <div className="pt-3">
            <p className="text-[10px] font-black text-[var(--muted-foreground)] uppercase tracking-widest mb-1">Addresses</p>
            <p className="text-xs text-[var(--muted-foreground)] italic leading-relaxed">&ldquo;{story.jd_requirement}&rdquo;</p>
          </div>

          {/* STAR+R sections */}
          {[
            { label: 'Situation', content: story.situation, color: 'text-blue-400' },
            { label: 'Task', content: story.task, color: 'text-purple-400' },
            { label: 'Action', content: story.action, color: 'text-[var(--primary)]' },
            { label: 'Result', content: story.result, color: 'text-[var(--accent)]' },
            { label: 'Reflection', content: story.reflection, color: 'text-amber-400' },
          ].map(({ label, content, color }) => (
            <div key={label}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${color}`}>{label}</p>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{content}</p>
            </div>
          ))}

          {/* Best for tags */}
          {story.best_for.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] font-black text-[var(--muted-foreground)] uppercase tracking-widest mb-1.5">Best for questions about</p>
              <div className="flex flex-wrap gap-1.5">
                {story.best_for.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InterviewPrep({ job, resume, existingStories }: InterviewPrepProps) {
  const { isGuest } = useAuth();
  const [stories, setStories] = useState<InterviewStory[]>(existingStories);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
        const result = await generateInterviewStories(
          resume.source,
          job.jd_text,
          job.id,
          aiConfig,
        );
        setStories(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate stories';
        setError(message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold">Interview Prep</h2>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            STAR+R stories mapped to the job requirements for <span className="font-medium text-foreground">{job.role}</span> at <span className="font-medium text-foreground">{job.company}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tailor/${job.id}`}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] transition-colors"
          >
            Back to Tailor
          </Link>
          <button
            onClick={handleGenerate}
            disabled={isPending || !resume}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-white text-gray-900 hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            {isPending ? 'Generating...' : stories.length > 0 ? 'Regenerate Stories' : 'Generate Stories'}
          </button>
        </div>
      </div>

      {/* Token notice */}
      {!isGuest && (
        <p className="text-xs text-[var(--muted-foreground)] opacity-60">
          Uses 1 token per generation
        </p>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          {error.includes('No tokens remaining') && (
            <Link href="/pricing" className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 underline ml-3">
              Buy more tokens
            </Link>
          )}
        </div>
      )}

      {/* Stories */}
      {stories.length > 0 ? (
        <div className="space-y-3">
          {stories.map((story, i) => (
            <StoryCard key={story.id} story={story} index={i} />
          ))}

          {/* Quick reference */}
          <div className="bg-[var(--card)] border border-[var(--border)]/60 rounded-xl p-5">
            <p className="text-[10px] font-black text-[var(--muted-foreground)] uppercase tracking-widest mb-3">Quick Reference — Question Coverage</p>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(stories.flatMap((s) => s.best_for))].map((tag) => {
                const count = stories.filter((s) => s.best_for.includes(tag)).length;
                return (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-muted/50 text-[var(--muted-foreground)] border border-[var(--border)]/40"
                  >
                    {tag} <span className="opacity-50">({count})</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ) : !isPending ? (
        <div className="border border-dashed border-[var(--border)] rounded-2xl py-16 flex flex-col items-center justify-center bg-muted/20">
          <div className="w-14 h-14 rounded-full bg-background border border-[var(--border)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--muted-foreground)]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-foreground">No interview stories yet</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Generate STAR+R stories tailored to this job description
          </p>
        </div>
      ) : null}
    </div>
  );
}
