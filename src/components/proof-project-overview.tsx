import { ArrowRight, FileCheck2, Link2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

const SIGNALS = [
  {
    state: 'Live',
    title: 'Public work',
    detail: 'Source links, repos, work samples, and measurable outcomes attached to a claim.',
  },
  {
    state: 'Next',
    title: 'Employer verification',
    detail: 'Confirmed roles and references stay in TrueHire until a consented bridge is ready.',
  },
  {
    state: 'Planned',
    title: 'Application proof',
    detail: 'RolePatch packets can carry selected proof without rewriting the resume.',
  },
  {
    state: 'Planned',
    title: 'Recruiter evidence',
    detail: 'Replies can reference proof only when the recruiter asks and the user opts in.',
  },
];

const METHOD = [
  {
    title: 'Derived, not declared',
    detail:
      'A proof record should point back to source material instead of asking candidates to decorate a claim.',
  },
  {
    title: 'Private until attached',
    detail:
      'RolePatch can preview and import proof, but applications only receive it through explicit user action.',
  },
  {
    title: 'Every number needs a source',
    detail:
      'Scores, receipts, and proof status stay inspectable so recruiters can audit the basis of a claim.',
  },
];

const LANES = [
  'TrueHire remains the proof front door and brand lane.',
  'RolePatch remains the private application operating surface.',
  'Imported proof becomes achievement evidence first, not automatic employer-facing content.',
  'Packets and receipts preserve source links for user-controlled sharing.',
];

const HERO_EVIDENCE = [
  { label: 'Public source', value: 'github.com/acme/checkout', status: 'linked' },
  { label: 'Outcome', value: '31% faster onboarding', status: 'measured' },
  { label: 'Receipt boundary', value: 'private until attached', status: 'locked' },
];

export function ProofProjectOverview({ proofPreview }: { proofPreview?: ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 pb-12 pt-14 lg:pb-16 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:items-start">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                TrueHire proof project
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight text-foreground sm:text-6xl">
                Your resume can be tailored. Your work still has to prove itself.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
                TrueHire stays as the credibility layer under RolePatch: costly signals,
                source-backed proof, and recruiter-ready evidence that users control before anything
                reaches an application.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/evidence"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent)]/90"
                >
                  <FileCheck2 className="h-4 w-4" />
                  Open evidence bank
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-5 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--muted)]"
                >
                  Review apply packets
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                    Proof profile
                  </p>
                  <p className="mt-2 text-sm font-bold text-foreground">Candidate credibility</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-black leading-none text-foreground">88</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
                    sourced
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {HERO_EVIDENCE.map((item) => (
                  <div
                    key={item.label}
                    className="grid gap-2 rounded-md border border-[var(--border)] bg-background/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                        {item.label}
                      </span>
                      <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--accent)]">
                        {item.status}
                      </span>
                    </div>
                    <p className="truncate text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-3">
                <p className="text-xs font-bold text-foreground">No auto-share boundary</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  Proof moves into packets, receipts, or replies only after explicit user review.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <div className="grid border-b border-[var(--border)] md:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-[var(--border)] p-5 md:border-b-0 md:border-r">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                  Candidate proof profile
                </p>
                <div className="mt-5 flex items-end gap-4">
                  <div className="text-6xl font-black leading-none text-foreground">88</div>
                  <div className="pb-1">
                    <p className="text-sm font-bold text-foreground">source-backed score</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      derived from public work and confirmed signals
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-0 sm:grid-cols-3">
                <ProofMetric label="Sources" value="12" detail="links preserved" />
                <ProofMetric label="Claims" value="7" detail="packet candidates" />
                <ProofMetric label="Sharing" value="opt-in" detail="never automatic" />
              </div>
            </div>
            <div className="grid gap-0 md:grid-cols-3">
              <ProofRow
                label="Claim"
                value="Reduced onboarding time by 31%"
                detail="Outcome, role, and source link stay together."
              />
              <ProofRow
                label="Evidence"
                value="Launch report, metrics screenshot, manager reference"
                detail="Visible as review material before packet copy."
              />
              <ProofRow
                label="Receipt"
                value="Source included only after user-controlled sharing"
                detail="Audit trail records what was available and what stayed private."
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">
              Costly signals over cheap claims
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground">
              Keep the proof brand clean.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              RolePatch should stay focused on applying. TrueHire should keep the sharper promise:
              evidence first, deterministic sources, and proof that is harder to fake than a
              rewritten resume.
            </p>
          </div>

          <div className="mt-8 grid overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] md:grid-cols-2 lg:grid-cols-4">
            {SIGNALS.map((item) => (
              <article
                key={item.title}
                className="border-b border-[var(--border)] p-5 last:border-b-0 md:border-r md:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                    {item.state}
                  </span>
                  {item.state === 'Live' ? (
                    <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                  ) : (
                    <Link2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                  )}
                </div>
                <h3 className="mt-5 text-base font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">
            Derived, not declared
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-foreground">
            Proof should explain where trust came from.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
            This separate project path lets TrueHire keep its evidence-first voice while RolePatch
            uses the proof only at the moments that matter: evidence cleanup, packet review, receipt
            audit, and recruiter follow-up.
          </p>
        </div>

        <div className="grid gap-4">
          {METHOD.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <h3 className="text-base font-bold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--muted)]/20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent)]">
              Separate by default
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground">
              One ecosystem, two jobs.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              This avoids confusing users with two dashboards. TrueHire is the public proof lane;
              RolePatch is the private workflow lane.
            </p>
          </div>

          <ol className="grid gap-3">
            {LANES.map((item, index) => (
              <li key={item} className="flex gap-3 rounded-lg bg-background p-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-black text-[var(--accent)]">
                  {index + 1}
                </span>
                <span className="text-sm leading-6 text-foreground">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {proofPreview}
    </main>
  );
}

function ProofMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-[var(--border)] p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-[11px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-black text-foreground">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function ProofRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-[var(--border)] p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <p className="text-[11px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-3 text-sm font-bold text-foreground">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}
