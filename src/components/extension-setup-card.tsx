const SUPPORTED_PROVIDERS = [
  'Greenhouse',
  'Lever',
  'Workday',
  'Ashby',
  'Workable',
  'Recruitee',
  'Personio',
  'SmartRecruiters',
];

const SETUP_ITEMS = [
  { label: 'Package', value: 'pnpm --dir extension build' },
  { label: 'Load path', value: 'extension/dist' },
  { label: 'API base', value: 'https://rolepatch.com' },
  { label: 'Auth', value: 'Signed-in browser profile' },
];

export function ExtensionSetupCard() {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]/30 p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Chrome extension</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Store-ready package checks for reviewed ATS fill and receipt capture.
          </p>
        </div>
        <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
          Unpacked build
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {SETUP_ITEMS.map((item) => (
          <div key={item.label} className="rounded-lg border border-[var(--border)] p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {item.label}
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            ATS coverage
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_PROVIDERS.map((provider) => (
              <span
                key={provider}
                className="rounded-full border border-[var(--border)] bg-muted/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]"
              >
                {provider}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-amber-400/25 bg-amber-500/5 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">
            Boundary
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Uses active-tab access and provider host permissions. No all-site permission, captcha
            bypass, or unattended bulk apply.
          </p>
        </div>
      </div>
    </section>
  );
}
