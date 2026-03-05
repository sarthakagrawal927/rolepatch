'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import type { JobApplication, Resume, TailoredResume } from '@/lib/types';
import { tailorResume } from '@/lib/actions/tailor-action';
import { saveTailoredResume } from '@/lib/actions/job-actions';
import { ResumeDiff } from '@/components/resume-diff';
import { useAuth } from '@/components/auth-provider';
import {
  localGetResume,
  localGetTailoredResumes,
  localSaveTailoredResume,
  localListStashEntries,
} from '@/lib/local-storage';

interface TailorFlowProps {
  job: JobApplication;
  serverResume: Resume | null;
  existingTailored: TailoredResume[];
}

export function TailorFlow({ job, serverResume, existingTailored }: TailorFlowProps) {
  const { isGuest } = useAuth();
  const [resume, setResume] = useState<Resume | null>(serverResume);
  const [tailoredList, setTailoredList] = useState(existingTailored);

  // For guests, resolve resume and tailored from localStorage
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
    latestTailored?.source ?? null,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sync tailoredSource when tailoredList updates from localStorage
  useEffect(() => {
    const latest = tailoredList[0] ?? null;
    if (latest?.source && !tailoredSource) {
      setTailoredSource(latest.source);
    }
  }, [tailoredList]);

  function handleGenerate() {
    if (!resume) return;
    setError(null);
    startTransition(async () => {
      try {
        const aiConfig = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
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
        setTailoredSource(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate tailored resume');
      }
    });
  }

  function handleSave() {
    if (!tailoredSource || !resume) return;
    startTransition(async () => {
      try {
        if (isGuest) {
          localSaveTailoredResume(job.id, resume.id, tailoredSource);
        } else {
          await saveTailoredResume(job.id, resume.id, tailoredSource);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save tailored resume');
      }
    });
  }

  if (!resume) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Resume not found. It may have been deleted.
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel: Job Description */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Job Description</h2>
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
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans leading-relaxed">
            {job.jd_text}
          </pre>
        </div>
      </div>

      {/* Right panel: Resume / Tailored output */}
      <div className="w-2/3 flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {tailoredSource ? 'Tailored Resume (diff)' : 'Original Resume'}
            </h2>
            <p className="text-xs text-gray-500">{resume.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/cover-letter/${job.id}`}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Generate Cover Letter
            </Link>
            {tailoredSource && (
              <button
                onClick={handleSave}
                disabled={isPending}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Accept & Save'}
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Generating...' : 'Generate Tailored Resume'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {tailoredSource ? (
            <ResumeDiff
              original={resume.source}
              modified={tailoredSource}
              onModifiedChange={setTailoredSource}
            />
          ) : (
            <div className="h-full overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                {resume.source}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
