'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { buildProofPacketPreview } from '@/lib/achievement-evidence';
import { localListAchievementEvidence } from '@/lib/local-storage';
import type { AchievementEvidence } from '@/lib/types';

interface Props {
  serverEntries: AchievementEvidence[];
}

export function ProofPacketPreview({ serverEntries }: Props) {
  const { isGuest } = useAuth();
  const [entries, setEntries] = useState(serverEntries);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (isGuest) setEntries(localListAchievementEvidence());
  }, [isGuest]);

  const preview = useMemo(() => buildProofPacketPreview(entries), [entries]);
  const hasEvidence = entries.length > 0;
  const shareableCount = preview.shareable.length;
  const needsWorkCount = preview.needsWork.length;

  async function copyProofProfile() {
    try {
      await navigator.clipboard.writeText(formatProofProfileSummary(preview.shareable));
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pb-14">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">
              Your proof packet
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
              Preview what can be shared.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              This preview uses your existing achievement evidence. Items remain private and
              user-provided until you attach them to an application packet or a later verification
              flow ships.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ProofMetric label="Shareable" value={shareableCount} />
            <ProofMetric label="Needs work" value={needsWorkCount} />
            <button
              type="button"
              onClick={copyProofProfile}
              disabled={shareableCount === 0}
              className="min-h-[48px] rounded-lg border border-[var(--border)] bg-background/40 px-3 text-xs font-bold text-foreground transition-colors hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copyState === 'copied'
                ? 'Copied proof'
                : copyState === 'failed'
                  ? 'Copy failed'
                  : 'Copy proof profile'}
            </button>
          </div>
        </div>

        {!hasEvidence ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-foreground">No proof evidence yet</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--muted-foreground)]">
              Add quantified achievements first, then return here to preview candidate proof
              packets.
            </p>
            <Link
              href="/evidence"
              className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--muted)]"
            >
              Add evidence
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.82fr]">
            <div>
              <h3 className="text-sm font-bold text-foreground">Ready for packet review</h3>
              <div className="mt-3 space-y-3">
                {preview.shareable.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
                    No evidence is packet-ready yet. Add metrics, context, and tags in the evidence
                    bank.
                  </p>
                ) : (
                  preview.shareable.map((item) => <ProofItem key={item.id} item={item} />)
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-foreground">Needs proof cleanup</h3>
              <div className="mt-3 space-y-3">
                {preview.needsWork.length === 0 ? (
                  <p className="rounded-lg border border-[var(--border)] bg-background/40 p-4 text-sm text-[var(--muted-foreground)]">
                    All saved evidence is ready for packet review.
                  </p>
                ) : (
                  preview.needsWork.map((item) => <ProofItem key={item.id} item={item} compact />)
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function formatProofProfileSummary(
  items: ReturnType<typeof buildProofPacketPreview>['shareable']
): string {
  const lines = [
    'RolePatch proof profile',
    'Boundary: These proof points are user-reviewed context. Nothing is shared automatically.',
    '',
    'Proof points:',
  ];
  if (items.length === 0) {
    lines.push('- None available');
  } else {
    for (const item of items) {
      lines.push(`- ${item.title} [${item.readiness.label}]: ${item.claim}`);
      if (item.tags.length > 0) lines.push(`  Tags: ${item.tags.join(', ')}`);
      if (item.source_url) lines.push(`  Source: ${item.source_url}`);
      if (item.readiness.missing.length > 0) {
        lines.push(`  Missing: ${item.readiness.missing.join(', ')}`);
      }
    }
  }
  return lines.join('\n');
}

function ProofMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-lg border border-[var(--border)] bg-background/40 px-3 py-2 text-right">
      <p className="text-xl font-black text-foreground">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </p>
    </div>
  );
}

function ProofItem({
  item,
  compact = false,
}: {
  item: ReturnType<typeof buildProofPacketPreview>['shareable'][number];
  compact?: boolean;
}) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-background/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--accent)]">
          {item.readiness.label}
        </span>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          {item.impact}
        </span>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
          User-provided
        </span>
      </div>
      <h4 className="mt-3 text-sm font-bold text-foreground">{item.title}</h4>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{item.claim}</p>
      {!compact && item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-[11px] font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
        >
          View source
        </a>
      )}
      {item.readiness.missing.length > 0 && (
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          Missing: {item.readiness.missing.join(', ')}
        </p>
      )}
    </article>
  );
}
