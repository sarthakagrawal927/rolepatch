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
  type TrueHireRoleFitPreview,
  type TrueHireRoleFitRequirement,
} from '@/lib/truehire-proof';
import { localCreateAchievementEvidence, localListAchievementEvidence } from '@/lib/local-storage';

interface PreviewResponse {
  ok: boolean;
  error?: string;
  source_url?: string;
  profile?: TrueHireProofProfile;
  items?: TrueHireProofItem[];
}

interface RoleFitResponse {
  ok: boolean;
  error?: string;
  source_url?: string;
  boundary?: string;
  role_fit?: TrueHireRoleFitPreview;
}

export function TrueHireProofPreview() {
  const { isGuest } = useAuth();
  const [handle, setHandle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRoleFitLoading, setIsRoleFitLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFitError, setRoleFitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [roleFit, setRoleFit] = useState<RoleFitResponse | null>(null);

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

  async function loadRoleFit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = handle.trim();
    const jd = jobDescription.trim();
    if (!value) {
      setRoleFitError('Enter a TrueHire handle or profile URL.');
      return;
    }
    if (jd.length < 40) {
      setRoleFitError('Paste at least 40 characters of job description.');
      return;
    }

    setIsRoleFitLoading(true);
    setRoleFitError(null);
    setRoleFit(null);
    try {
      const params = new URLSearchParams({ handle: value, jd });
      const response = await fetch(`/api/proof/truehire-role-fit?${params.toString()}`);
      const json = (await response.json()) as RoleFitResponse;
      if (!response.ok || !json.ok) {
        setRoleFitError(json.error ?? 'TrueHire role-fit preview is unavailable right now.');
        return;
      }
      setRoleFit(json);
    } catch {
      setRoleFitError('TrueHire role-fit preview is unavailable right now.');
    } finally {
      setIsRoleFitLoading(false);
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

        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">
                Role-fit JSON preview
              </p>
              <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">
                Consume TrueHire fit without sharing.
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Paste a job description to read TrueHire&apos;s public role-fit JSON for this
                handle. This report stays preview-only in RolePatch; it is not imported into
                evidence, attached to packets, or sent to employers.
              </p>
            </div>

            <form onSubmit={loadRoleFit} className="space-y-3">
              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                rows={5}
                minLength={40}
                placeholder="Paste the role description..."
                aria-label="Role-fit job description"
                className="min-h-32 w-full resize-y rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                  Uses the handle above. No application packet changes are made.
                </p>
                <button
                  type="submit"
                  disabled={isRoleFitLoading}
                  className="min-h-[44px] rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRoleFitLoading ? 'Analyzing...' : 'Analyze role fit'}
                </button>
              </div>
            </form>
          </div>

          {roleFitError && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {roleFitError}
            </p>
          )}

          {roleFit?.role_fit && (
            <div className="mt-5 rounded-lg border border-[var(--border)] bg-background/40 p-4">
              <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    @{roleFit.role_fit.handle}
                  </p>
                  <h4 className="mt-1 text-sm font-bold text-foreground">
                    TrueHire role-fit report
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    {roleFit.boundary ??
                      'Role-fit preview is read-only. Nothing is shared automatically.'}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-3xl font-black text-foreground">
                    {roleFit.role_fit.fit_score}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    Fit score
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PreviewMetric
                  label="Requirements"
                  value={roleFit.role_fit.summary.total_requirements}
                />
                <PreviewMetric
                  label="Verified"
                  value={roleFit.role_fit.summary.verified_requirements}
                />
                <PreviewMetric label="Gaps" value={roleFit.role_fit.summary.gap_count} />
                <PreviewMetric
                  label="Languages"
                  value={roleFit.role_fit.summary.top_languages.length}
                />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <RoleFitList
                  title="Verified strengths"
                  empty="No verified strengths returned for this role."
                  items={roleFit.role_fit.verified_strengths}
                />
                <RoleFitList
                  title="Gaps to inspect"
                  empty="No role-fit gaps returned for this role."
                  items={roleFit.role_fit.gaps}
                />
              </div>
            </div>
          )}
        </div>
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

function RoleFitList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: TrueHireRoleFitRequirement[];
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-foreground">{title}</h4>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
            {empty}
          </p>
        ) : (
          items.map((item) => <RoleFitItem key={`${title}:${item.label}`} item={item} />)
        )}
      </div>
    </div>
  );
}

function RoleFitItem({ item }: { item: TrueHireRoleFitRequirement }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-background/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--accent)]">
          {item.score}/100
        </span>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          {item.category}
        </span>
      </div>
      <h5 className="mt-3 text-sm font-bold text-foreground">{item.label}</h5>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{item.remediation}</p>
      {item.strengths.length > 0 && (
        <div className="mt-3 space-y-2">
          {item.strengths.map((strength) => (
            <div
              key={`${item.label}:${strength.repo_full_name}`}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            >
              <p className="text-xs font-semibold text-foreground">{strength.repo_full_name}</p>
              <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                {[
                  strength.primary_language,
                  strength.commits > 0 ? `${strength.commits.toLocaleString()} commits` : '',
                  strength.merged_prs > 0
                    ? `${strength.merged_prs.toLocaleString()} merged PRs`
                    : '',
                  strength.stars > 0 ? `${strength.stars.toLocaleString()} stars` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
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
