import type { OperationalReadiness, OperationalReadinessStatus } from '@/lib/operational-readiness';

const STATUS_LABELS: Record<OperationalReadinessStatus, string> = {
  ready: 'Ready',
  needs_setup: 'Needs setup',
  code_ready: 'Code ready',
};

const STATUS_CLASSES: Record<OperationalReadinessStatus, string> = {
  ready: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  needs_setup: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  code_ready: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
};

export function OperationalReadinessCard({ readiness }: { readiness: OperationalReadiness }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]/30 p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Operational readiness</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Cloudflare-first runtime checks for automation, email, auth, and AI.
          </p>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {new Date(readiness.generatedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {readiness.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-[var(--border)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">{item.label}</h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASSES[item.status]}`}
              >
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{item.detail}</p>
            {item.nextStep ? (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">Next: {item.nextStep}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
