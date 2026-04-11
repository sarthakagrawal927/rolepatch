'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import type { JobApplication, Resume, CoverLetter } from '@/lib/types';
import { generateCoverLetter, updateCoverLetter } from '@/lib/actions/cover-letter-action';
import { useAuth } from '@/components/auth-provider';
import {
  localGetResume,
  localGetCoverLetter,
  localSaveCoverLetter,
  localUpdateCoverLetter,
} from '@/lib/local-storage';

interface CoverLetterEditorProps {
  job: JobApplication;
  serverResume: Resume | null;
  existingLetter: CoverLetter | null;
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

  function handleGenerate() {
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
        );
        setContent(result);
        // For guests, also save locally
        if (isGuest) {
          const id = localSaveCoverLetter(job.id, resume.id, result, '');
          setLetterId(id);
        } else {
          // The server action saves and returns text; we need the new ID for future saves
          // Reset letterId so next save works via a regeneration flow
          setLetterId('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate cover letter');
      } finally {
        setGenerating(false);
      }
    });
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
      <div className="flex items-center justify-center py-12 text-gray-500">
        Resume not found. It may have been deleted.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 text-sm font-medium transition-colors"
        >
          {generating ? 'Generating...' : content ? 'Regenerate' : 'Generate Cover Letter'}
        </button>

        {content && letterId && (
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}

        {saveMessage && (
          <span className="text-sm text-[var(--accent)]">{saveMessage}</span>
        )}

        <Link
          href={`/tailor/${job.id}`}
          className="ml-auto text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Tailor
        </Link>
      </div>

      {/* Cover letter textarea */}
      {content ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-[60vh] px-6 py-5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-base leading-relaxed font-serif resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <div className="w-full h-[60vh] flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm">
          Click &quot;Generate Cover Letter&quot; to get started
        </div>
      )}
    </div>
  );
}
