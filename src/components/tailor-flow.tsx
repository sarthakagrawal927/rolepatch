'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { JobApplication, Resume, TailoredResume } from '@/lib/types';
import { tailorResume } from '@/lib/actions/tailor-action';
import { saveTailoredResume } from '@/lib/actions/job-actions';
import { LatexDiff } from '@/components/latex-diff';

interface TailorFlowProps {
  job: JobApplication;
  resume: Resume;
  existingTailored: TailoredResume[];
}

export function TailorFlow({ job, resume, existingTailored }: TailorFlowProps) {
  const latestTailored = existingTailored[0] ?? null;
  const [tailoredSource, setTailoredSource] = useState<string | null>(
    latestTailored?.latex_source ?? null,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const aiConfig = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
        const result = await tailorResume(resume.latex_source, job.jd_text, aiConfig);
        setTailoredSource(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate tailored resume');
      }
    });
  }

  function handleSave() {
    if (!tailoredSource) return;
    startTransition(async () => {
      try {
        await saveTailoredResume(job.id, resume.id, tailoredSource);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save tailored resume');
      }
    });
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel: Job Description */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Job Description</h2>
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
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
            {job.jd_text}
          </pre>
        </div>
      </div>

      {/* Right panel: Resume / Tailored output */}
      <div className="w-2/3 flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              {tailoredSource ? 'Tailored Resume (diff)' : 'Original Resume'}
            </h2>
            <p className="text-xs text-gray-500">{resume.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/cover-letter/${job.id}`}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100"
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
            <LatexDiff
              original={resume.latex_source}
              modified={tailoredSource}
              onModifiedChange={setTailoredSource}
            />
          ) : (
            <div className="h-full overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                {resume.latex_source}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
