'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { ATSScoreBadge } from '@/components/ats-score-badge';
import { useAuth } from '@/components/auth-provider';
import { FitScoreCard } from '@/components/fit-score-card';
import { ResumeDiff } from '@/components/resume-diff';
import { ShareScoreButton } from '@/components/share-score-button';
import { SkillsRoadmapPanel } from '@/components/skills-roadmap';
import { generateFitScore } from '@/lib/actions/fit-score-action';
import { saveTailoredResume } from '@/lib/actions/job-actions';
import { tailorResume } from '@/lib/actions/tailor-action';
import { getTokenBalance } from '@/lib/actions/token-actions';
import { calculateATSScore } from '@/lib/ats-score';
import {
  localGetResume,
  localGetTailoredResumes,
  localListStashEntries,
  localSaveTailoredResume,
} from '@/lib/local-storage';
import type { JobApplication, Resume, TailorChange, TailoredResume } from '@/lib/types';
import type { FitScore } from '@/lib/types';

interface TailorFlowProps {
  job: JobApplication;
  serverResume: Resume | null;
  existingTailored: TailoredResume[];
  existingFitScore?: FitScore | null;
}

export function TailorFlow({
  job,
  serverResume,
  existingTailored,
  existingFitScore,
}: TailorFlowProps) {
  const { isGuest } = useAuth();
  const [resume, setResume] = useState<Resume | null>(serverResume);
  const [tailoredList, setTailoredList] = useState(existingTailored);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [fitScore, setFitScore] = useState<FitScore | null>(existingFitScore ?? null);
  const [fitScoreLoading, setFitScoreLoading] = useState(false);

  // Fetch token balance on mount for signed-in users
  useEffect(() => {
    if (!isGuest) {
      getTokenBalance()
        .then(setTokenBalance)
        .catch(() => {});
    }
  }, [isGuest]);

  // Intentional: hydrate from localStorage for guest users after auth context resolves
  useEffect(() => {
    if (isGuest) {
      if (!serverResume) {
        const local = localGetResume(job.resume_id);
        if (local) setResume(local);
      }
      const localTailored = localGetTailoredResumes(job.id);
      if (localTailored.length > 0) {
        setTailoredList(localTailored);
      }
    }
  }, [isGuest, serverResume, job.resume_id, job.id]);

  const latestTailored = tailoredList[0] ?? null;
  const [tailoredSource, setTailoredSource] = useState<string | null>(
    latestTailored?.source ?? null
  );
  const [changes, setChanges] = useState<TailorChange[]>(latestTailored?.changes ?? []);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sync tailoredSource when tailoredList updates from localStorage
  useEffect(() => {
    const latest = tailoredList[0] ?? null;
    if (latest?.source && !tailoredSource) {
      setTailoredSource(latest.source);
      setChanges(latest.changes ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run when tailoredList changes, not when tailoredSource changes
  }, [tailoredList, tailoredSource]);

  // ATS scores -- recalculate when resume/tailored/JD changes
  const originalATS = useMemo(
    () => (resume ? calculateATSScore(resume.source, job.jd_text) : null),
    [resume, job.jd_text]
  );

  const tailoredATS = useMemo(
    () => (tailoredSource ? calculateATSScore(tailoredSource, job.jd_text) : null),
    [tailoredSource, job.jd_text]
  );

  // Cache ATS scores to localStorage so the dashboard can display them
  useEffect(() => {
    if (tailoredATS && tailoredATS.totalKeywords > 0) {
      try {
        const cache = JSON.parse(localStorage.getItem('rt-ats-scores') ?? '{}');
        cache[job.id] = { original: originalATS?.score ?? 0, tailored: tailoredATS.score };
        localStorage.setItem('rt-ats-scores', JSON.stringify(cache));
      } catch {
        /* ignore */
      }
    }
  }, [job.id, originalATS, tailoredATS]);

  function handleGenerate() {
    if (!resume) return;

    // If signed-in user has no tokens, don't attempt generation
    if (!isGuest && tokenBalance !== null && tokenBalance <= 0) {
      setError('No tokens remaining.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const settings = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
        const aiConfig = {
          endpointUrl: settings.endpointUrl || '',
          apiKey: settings.apiKey || '',
          model: settings.model || '',
        };
        // For guests, pass stash content from localStorage
        let stashContent: string | undefined;
        if (isGuest) {
          const stashEntries = localListStashEntries();
          if (stashEntries.length > 0) {
            stashContent = stashEntries
              .map((e) => `### [${e.category}] ${e.label}\n${e.content}`)
              .join('\n\n');
          }
        }
        const result = await tailorResume(resume.source, job.jd_text, aiConfig, stashContent);
        setTailoredSource(result.tailored);
        setChanges(result.changes ?? []);

        // Refresh token balance after successful generation
        if (!isGuest) {
          getTokenBalance()
            .then(setTokenBalance)
            .catch(() => {});
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate tailored resume';
        if (message.includes('No tokens remaining') || message.includes('insufficient_tokens')) {
          setError('No tokens remaining.');
          setTokenBalance(0);
        } else {
          setError(message);
        }
      }
    });
  }

  function handleSave() {
    if (!tailoredSource || !resume) return;
    startTransition(async () => {
      try {
        if (isGuest) {
          localSaveTailoredResume(job.id, resume.id, tailoredSource, changes);
        } else {
          await saveTailoredResume(job.id, resume.id, tailoredSource, changes);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save tailored resume');
      }
    });
  }

  if (!resume) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
        Resume not found. It may have been deleted.
      </div>
    );
  }

  function handleFitScore() {
    if (!resume) return;
    setFitScoreLoading(true);
    const settings = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
    const aiConfig = {
      endpointUrl: settings.endpointUrl || '',
      apiKey: settings.apiKey || '',
      model: settings.model || '',
    };
    generateFitScore(resume.source, job.jd_text, job.id, aiConfig)
      .then((result) => {
        setFitScore(result);
        if (!isGuest) {
          getTokenBalance()
            .then(setTokenBalance)
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setFitScoreLoading(false));
  }

  const showNoTokens = !isGuest && tokenBalance !== null && tokenBalance <= 0;

  return (
    <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">
      {/* Left panel: Job Description */}
      <div className="w-full md:w-1/3 min-h-[50vh] md:min-h-0 border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]/50">
          <h2 className="text-sm font-semibold text-foreground">Job Description</h2>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline truncate block"
            >
              {job.url}
            </a>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
            {job.jd_text}
          </pre>

          {/* Fit Score + Interview Prep section */}
          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            {fitScore ? (
              <FitScoreCard fitScore={fitScore} />
            ) : (
              <button
                onClick={handleFitScore}
                disabled={fitScoreLoading || !resume}
                className="w-full px-3 py-2.5 text-sm font-medium rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 text-[var(--primary)] hover:bg-[var(--primary)]/10 disabled:opacity-40 transition-colors"
              >
                {fitScoreLoading ? 'Analyzing fit...' : 'Analyze Job Fit'}
              </button>
            )}
            <Link
              href={`/interview-prep/${job.id}`}
              className="block w-full px-3 py-2.5 text-sm font-medium rounded-xl border border-[var(--border)]/60 text-[var(--muted-foreground)] hover:bg-muted/10 transition-colors text-center"
            >
              Interview Prep (STAR Stories)
            </Link>
          </div>

          {/* Skills gap learning roadmap */}
          <div className="border-t border-[var(--border)] pt-4">
            <SkillsRoadmapPanel job={job} resume={resume} />
          </div>
        </div>
      </div>

      {/* Right panel: Resume / Tailored output */}
      <div className="w-full md:w-2/3 min-h-[70vh] md:min-h-0 flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {tailoredSource ? 'Tailored Resume (diff)' : 'Original Resume'}
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">{resume.name}</p>
            </div>

            {/* ATS Score badges */}
            {originalATS && originalATS.totalKeywords > 0 && (
              <div className="flex items-center gap-2">
                <ATSScoreBadge
                  score={originalATS.score}
                  matchedKeywords={originalATS.matchedKeywords}
                  missingKeywords={originalATS.missingKeywords}
                  label="Original"
                />
                {tailoredATS && (
                  <>
                    <span className="text-[var(--muted-foreground)] text-xs">{'\u2192'}</span>
                    <ATSScoreBadge
                      score={tailoredATS.score}
                      matchedKeywords={tailoredATS.matchedKeywords}
                      missingKeywords={tailoredATS.missingKeywords}
                      label="Tailored"
                    />
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Token balance indicator for signed-in users */}
            {!isGuest && tokenBalance !== null && (
              <span className="text-xs text-[var(--muted-foreground)] mr-1">
                Uses 1 token ({tokenBalance} remaining)
              </span>
            )}
            <Link
              href={`/cover-letter/${job.id}`}
              className="inline-flex items-center min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] transition-colors"
            >
              Generate Cover Letter
            </Link>
            {tailoredSource && (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Saving...' : 'Accept & Save'}
              </button>
            )}
            {!isGuest && latestTailored?.id && tailoredATS && (
              <ShareScoreButton tailoredId={latestTailored.id} />
            )}
            {showNoTokens ? (
              <Link
                href="/pricing"
                className="inline-flex items-center min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent)] transition-colors"
              >
                Buy Tokens
              </Link>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isPending}
                className="min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-gray-900 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Generating...' : 'Generate Tailored Resume'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-sm text-red-400 flex items-center justify-between">
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

        <div className="flex-1 overflow-hidden">
          {tailoredSource ? (
            <ResumeDiff
              original={resume.source}
              modified={tailoredSource}
              onModifiedChange={setTailoredSource}
              changes={changes}
            />
          ) : (
            <div className="h-full overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono leading-relaxed">
                {resume.source}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
