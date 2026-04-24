'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { importResumeFromFile } from '@/lib/actions/import-action';
import { useAuth } from '@/components/auth-provider';
import { localCreateResume } from '@/lib/local-storage';

const ACCEPTED = '.pdf,.doc,.docx,.txt,.md';
const MAX_MB = 5;

export function ResumeImportButton() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking same file
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_MB}MB)`);
      return;
    }

    startTransition(async () => {
      try {
        const settings = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
        const aiConfig = {
          endpointUrl: settings.endpointUrl || '',
          apiKey: settings.apiKey || '',
          model: settings.model || '',
        };
        const name = file.name.replace(/\.(pdf|docx?|txt|md)$/i, '') || 'Imported Resume';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);

        const { id, source } = await importResumeFromFile(formData, aiConfig);

        const finalId = isGuest ? localCreateResume(name, source) : id;
        router.push(`/editor/${finalId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={onFile}
        className="hidden"
      />
      <button
        onClick={onClick}
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] hover:border-[var(--muted-foreground)] transition-colors disabled:opacity-50"
        title="Import resume from PDF, DOCX, or Markdown"
      >
        {isPending ? 'Importing…' : '↑ Import Resume'}
      </button>
      {error && (
        <span className="text-xs text-red-500 ml-2" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
