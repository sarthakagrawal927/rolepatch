'use client';

import type { JobApplication, Resume, TailoredResume } from '@/lib/types';

interface TailorFlowProps {
  job: JobApplication;
  resume: Resume;
  existingTailored: TailoredResume[];
}

export function TailorFlow({ job, resume, existingTailored }: TailorFlowProps) {
  const latestTailored = existingTailored[0] ?? null;
  const displaySource = latestTailored?.latex_source ?? resume.latex_source;

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
              {latestTailored ? 'Tailored Resume' : 'Original Resume'}
            </h2>
            <p className="text-xs text-gray-500">{resume.name}</p>
          </div>
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled
            title="Will be wired to AI in Task 10"
          >
            Generate Tailored Resume
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
            {displaySource}
          </pre>
        </div>
      </div>
    </div>
  );
}
