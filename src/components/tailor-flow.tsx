'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { ATSScoreBadge } from '@/components/ats-score-badge';
import { useAuth } from '@/components/auth-provider';
import { FitScoreCard } from '@/components/fit-score-card';
import { ResumeDiff } from '@/components/resume-diff';
import { ShareScoreButton } from '@/components/share-score-button';
import { SkillsRoadmapPanel } from '@/components/skills-roadmap';
import {
  formatEvidenceBullet,
  rankEvidenceForJob,
  scoreEvidenceQuality,
} from '@/lib/achievement-evidence';
import { generateFitScore } from '@/lib/actions/fit-score-action';
import { saveTailoredResume } from '@/lib/actions/job-actions';
import { tailorResume } from '@/lib/actions/tailor-action';
import { getTokenBalance } from '@/lib/actions/token-actions';
import { calculateATSScore } from '@/lib/ats-score';
import {
  localGetFitScore,
  localGetJob,
  localGetTailoredResumes,
  localListAchievementEvidence,
  localListResumes,
  localListStashEntries,
  localSaveFitScore,
  localSaveTailoredResume,
} from '@/lib/local-storage';
import type {
  AchievementEvidence,
  JobApplication,
  Resume,
  StashEntry,
  TailorChange,
  TailoredResume,
} from '@/lib/types';
import type { FitScore } from '@/lib/types';

interface TailorFlowProps {
  jobId: string;
  job: JobApplication | null;
  serverResume: Resume | null;
  serverResumes: Resume[];
  serverStashEntries: StashEntry[];
  serverEvidence: AchievementEvidence[];
  existingTailored: TailoredResume[];
  existingFitScore?: FitScore | null;
}

export function TailorFlow({
  jobId,
  job,
  serverResume,
  serverResumes,
  serverStashEntries,
  serverEvidence,
  existingTailored,
  existingFitScore,
}: TailorFlowProps) {
  const { isGuest } = useAuth();
  const [activeJob, setActiveJob] = useState<JobApplication | null>(job);
  const [resumes, setResumes] = useState(serverResumes);
  const [resume, setResume] = useState<Resume | null>(serverResume);
  const [selectedResumeId, setSelectedResumeId] = useState(
    serverResume?.id ?? job?.resume_id ?? serverResumes[0]?.id ?? ''
  );
  const [stashEntries, setStashEntries] = useState(serverStashEntries);
  const [evidenceEntries, setEvidenceEntries] = useState(serverEvidence);
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
      const localJob = localGetJob(jobId);
      const localResumes = localListResumes();
      const localTailored = localGetTailoredResumes(jobId);
      const localFitScore = localGetFitScore(jobId);
      setActiveJob(localJob);
      setResumes(localResumes);
      setStashEntries(localListStashEntries());
      setEvidenceEntries(localListAchievementEvidence());
      if (!selectedResumeId && localJob?.resume_id) setSelectedResumeId(localJob.resume_id);
      if (!selectedResumeId && localResumes[0]) setSelectedResumeId(localResumes[0].id);
      if (localTailored.length > 0) setTailoredList(localTailored);
      if (localFitScore) setFitScore(localFitScore);
    }
  }, [isGuest, jobId, selectedResumeId]);

  useEffect(() => {
    if (!selectedResumeId) {
      setResume(null);
      return;
    }
    const selected = resumes.find((item) => item.id === selectedResumeId) ?? null;
    setResume(selected);
  }, [resumes, selectedResumeId]);

  const latestTailored =
    tailoredList.find((item) => item.resume_id === selectedResumeId) ?? tailoredList[0] ?? null;
  const [tailoredSource, setTailoredSource] = useState<string | null>(
    latestTailored?.source ?? null
  );
  const [changes, setChanges] = useState<TailorChange[]>(latestTailored?.changes ?? []);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const remixOptions = useMemo(() => {
    const rankedEvidence = activeJob
      ? rankEvidenceForJob(evidenceEntries, activeJob.role, activeJob.jd_text)
          .filter((entry) => entry.quality !== 'weak')
          .slice(0, 6)
      : [];
    return [
      ...stashEntries.map((entry) => ({
        id: `stash:${entry.id}`,
        type: 'Project stash',
        category: entry.category,
        label: entry.label,
        content: `### [${entry.category}] ${entry.label}\n${entry.content}`,
        defaultSelected: entry.category === 'projects',
      })),
      ...rankedEvidence.map((entry) => ({
        id: `evidence:${entry.id}`,
        type: 'Evidence',
        category: entry.impact_type,
        label: entry.title,
        content: `- ${entry.title}: ${formatEvidenceBullet(entry)}`,
        defaultSelected: scoreEvidenceQuality(entry) === 'strong',
      })),
    ];
  }, [activeJob, evidenceEntries, stashEntries]);
  const [selectedRemixIds, setSelectedRemixIds] = useState<Set<string>>(new Set());

  // Sync tailoredSource when tailoredList updates from localStorage
  useEffect(() => {
    const latest =
      tailoredList.find((item) => item.resume_id === selectedResumeId) ??
      (selectedResumeId ? null : (tailoredList[0] ?? null));
    setTailoredSource(latest?.source ?? null);
    setChanges(latest?.changes ?? []);
  }, [tailoredList, selectedResumeId]);

  useEffect(() => {
    setSelectedRemixIds((prev) => {
      const available = new Set(remixOptions.map((option) => option.id));
      if (prev.size > 0) {
        return new Set([...prev].filter((id) => available.has(id)));
      }
      const defaults = remixOptions
        .filter((option) => option.defaultSelected)
        .map((option) => option.id);
      return new Set(defaults.length > 0 ? defaults : remixOptions.map((option) => option.id));
    });
  }, [remixOptions]);

  const remixContent = useMemo(
    () =>
      remixOptions
        .filter((option) => selectedRemixIds.has(option.id))
        .map((option) => option.content)
        .join('\n\n'),
    [remixOptions, selectedRemixIds]
  );

  // ATS scores -- recalculate when resume/tailored/JD changes
  const originalATS = useMemo(
    () => (resume && activeJob ? calculateATSScore(resume.source, activeJob.jd_text) : null),
    [resume, activeJob]
  );

  const tailoredATS = useMemo(
    () =>
      tailoredSource && activeJob ? calculateATSScore(tailoredSource, activeJob.jd_text) : null,
    [tailoredSource, activeJob]
  );

  // Cache ATS scores to localStorage so the dashboard can display them
  useEffect(() => {
    if (tailoredATS && tailoredATS.totalKeywords > 0) {
      try {
        const cache = JSON.parse(localStorage.getItem('rt-ats-scores') ?? '{}');
        cache[jobId] = { original: originalATS?.score ?? 0, tailored: tailoredATS.score };
        localStorage.setItem('rt-ats-scores', JSON.stringify(cache));
      } catch {
        /* ignore */
      }
    }
  }, [jobId, originalATS, tailoredATS]);

  function handleGenerate() {
    if (!resume || !activeJob) return;

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
        const result = await tailorResume(resume.source, activeJob.jd_text, aiConfig, remixContent);
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
          localSaveTailoredResume(jobId, resume.id, tailoredSource, changes);
        } else {
          await saveTailoredResume(jobId, resume.id, tailoredSource, changes);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save tailored resume');
      }
    });
  }

  if (!activeJob) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
        Job not found. It may have been deleted.
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--muted-foreground)]">
        Resume not found. It may have been deleted.
      </div>
    );
  }

  function handleFitScore() {
    if (!resume || !activeJob) return;
    setFitScoreLoading(true);
    const settings = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
    const aiConfig = {
      endpointUrl: settings.endpointUrl || '',
      apiKey: settings.apiKey || '',
      model: settings.model || '',
    };
    generateFitScore(resume.source, activeJob.jd_text, jobId, aiConfig)
      .then((result) => {
        setFitScore(result);
        if (isGuest) {
          localSaveFitScore(result);
        } else {
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
          {activeJob.url && (
            <a
              href={activeJob.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline truncate block"
            >
              {activeJob.url}
            </a>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
            {activeJob.jd_text}
          </pre>

          {remixOptions.length > 0 && (
            <div className="border-t border-[var(--border)] pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                  Remix Projects
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedRemixIds(new Set(remixOptions.map((option) => option.id)))
                    }
                    className="text-[10px] font-bold text-[var(--primary)] hover:underline"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRemixIds(new Set())}
                    className="text-[10px] font-bold text-[var(--muted-foreground)] hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {remixOptions.map((option) => {
                  const checked = selectedRemixIds.has(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`block rounded-xl border p-3 text-left transition-colors ${
                        checked
                          ? 'border-[var(--primary)]/40 bg-[var(--primary)]/5'
                          : 'border-[var(--border)]/70 hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            setSelectedRemixIds((prev) => {
                              const next = new Set(prev);
                              if (event.target.checked) next.add(option.id);
                              else next.delete(option.id);
                              return next;
                            });
                          }}
                          className="mt-0.5 accent-[var(--primary)]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-foreground">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wide text-[var(--muted-foreground)]">
                            {option.type} · {option.category}
                          </span>
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

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
              href={`/interview-prep/${jobId}`}
              className="block w-full px-3 py-2.5 text-sm font-medium rounded-xl border border-[var(--border)]/60 text-[var(--muted-foreground)] hover:bg-muted/10 transition-colors text-center"
            >
              Interview Prep (STAR Stories)
            </Link>
          </div>

          {/* Skills gap learning roadmap */}
          <div className="border-t border-[var(--border)] pt-4">
            <SkillsRoadmapPanel job={activeJob} resume={resume} />
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
              {resumes.length > 1 ? (
                <select
                  value={selectedResumeId}
                  onChange={(event) => {
                    setSelectedResumeId(event.target.value);
                    setFitScore(null);
                  }}
                  className="mt-1 max-w-52 rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-[var(--muted-foreground)]"
                >
                  {resumes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-[var(--muted-foreground)]">{resume.name}</p>
              )}
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
              href={`/cover-letter/${jobId}`}
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
