'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { importTrueHireProofEvidence } from '@/lib/actions/achievement-evidence-actions';
import {
  trueHireEvidenceDedupeKey,
  trueHireProofItemToEvidenceInput,
  type TrueHireProofItem,
  type TrueHireProofProfile,
} from '@/lib/truehire-proof';
import { localCreateAchievementEvidence, localListAchievementEvidence } from '@/lib/local-storage';

interface PreviewResponse {
  ok: boolean;
  error?: string;
  source_url?: string;
  profile?: TrueHireProofProfile;
  items?: TrueHireProofItem[];
}

export function TrueHireProofPreview() {
  const { isGuest } = useAuth();
  const [handle, setHandle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  async function loadPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = handle.trim();
    if (!value) {
      setError('Enter a TrueHire handle or profile URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotice(null);
    setPreview(null);
    try {
      const response = await fetch(
        `/api/proof/truehire-preview?handle=${encodeURIComponent(value)}`
      );
      const json = (await response.json()) as PreviewResponse;
      if (!response.ok || !json.ok) {
        setError(json.error ?? 'TrueHire preview is unavailable right now.');
        return;
      }
      setPreview(json);
    } catch {
      setError('TrueHire preview is unavailable right now.');
    } finally {
      setIsLoading(false);
    }
  }

  async function importPreview() {
    if (!preview?.profile || !preview.items || preview.items.length === 0) return;

    setIsImporting(true);
    setError(null);
    setNotice(null);
    try {
      if (isGuest) {
        const existingKeys = new Set(
          localListAchievementEvidence().map((entry) =>
            trueHireEvidenceDedupeKey({ title: entry.title, situation: entry.situation })
          )
        );
        let imported = 0;
        let skipped = 0;
        for (const item of preview.items) {
          const input = trueHireProofItemToEvidenceInput(item, preview.profile);
          const key = trueHireEvidenceDedupeKey(input);
          if (existingKeys.has(key)) {
            skipped += 1;
            continue;
          }
          localCreateAchievementEvidence(input);
          existingKeys.add(key);
          imported += 1;
        }
        setNotice(`Imported ${imported} proof item${imported === 1 ? '' : 's'} locally.`);
        if (skipped > 0) setNotice(`Imported ${imported}; skipped ${skipped} duplicates.`);
      } else {
        const result = await importTrueHireProofEvidence(preview.profile.handle);
        const summary = `Imported ${result.imported} proof item${
          result.imported === 1 ? '' : 's'
        } from @${result.handle}.`;
        setNotice(
          result.skipped > 0 ? `${summary} Skipped ${result.skipped} duplicates.` : summary
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TrueHire import is unavailable right now.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pb-14">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">
              TrueHire import preview
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
              Inspect proof before any merge.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              Paste a TrueHire handle to preview public score evidence and confirmed work history as
              RolePatch proof items. Previewing is read-only; importing saves private evidence for
              your review and still does not share anything.
            </p>
          </div>

          <form
            onSubmit={loadPreview}
            className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row"
          >
            <input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="@github-handle"
              aria-label="TrueHire handle"
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[44px] rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent)]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Previewing...' : 'Preview'}
            </button>
          </form>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3 text-sm text-foreground">
            {notice} Review imported evidence before attaching it to application packets.
          </p>
        )}

        {preview?.profile && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-lg border border-[var(--border)] bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    @{preview.profile.handle}
                  </p>
                  <a
                    href={preview.profile.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                  >
                    Open TrueHire profile
                  </a>
                  <button
                    type="button"
                    onClick={importPreview}
                    disabled={isImporting || !preview.items || preview.items.length === 0}
                    className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isImporting ? 'Importing...' : 'Import to evidence'}
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-foreground">
                    {preview.profile.overall_score ?? '-'}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Score
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <PreviewMetric label="Commits" value={preview.profile.public_work.commits} />
                <PreviewMetric label="Repos" value={preview.profile.public_work.repos} />
                <PreviewMetric label="Stars" value={preview.profile.public_work.stars} />
                <PreviewMetric
                  label="Verified roles"
                  value={preview.profile.verified_work_entries}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground">Mapped proof candidates</h3>
              <div className="mt-3 space-y-3">
                {preview.items && preview.items.length > 0 ? (
                  preview.items.map((item) => <TrueHireItem key={item.id} item={item} />)
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
                    This profile does not expose packet-ready proof items yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-background/40 px-3 py-2">
      <p className="text-lg font-black text-foreground">{value.toLocaleString()}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </p>
    </div>
  );
}

function TrueHireItem({ item }: { item: TrueHireProofItem }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-background/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--accent)]">
          {item.readiness}
        </span>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          {item.source_label}
        </span>
      </div>
      <h4 className="mt-3 text-sm font-bold text-foreground">{item.title}</h4>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{item.claim}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]"
          >
            {tag}
          </span>
        ))}
        <a
          href={item.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
        >
          View source
        </a>
      </div>
    </article>
  );
}
