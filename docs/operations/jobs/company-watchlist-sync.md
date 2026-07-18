---
title: Company-watchlist sync job
---

# Company-watchlist sync job

Hourly cron that syncs new jobs from signed-in users' company watches
into the apply-agent discovery feed.

## Schedule

- **Cron:** `0 * * * *` (every hour, on the hour) — configured in
  `wrangler.toml` `[triggers] crons`.
- **Dispatch:** `worker.mjs` matches `event.cron` against
  `SCHEDULED_TASKS` and dispatches a subrequest to
  `/api/internal/cron/company-watchlist` with the
  `x-rolepatch-internal: worker` header.
- **Manual trigger:** GitHub Actions `job-sync.yml` with the
  `company-watchlist` input, or any HTTP client with the internal
  secret header (`x-rolepatch-internal-secret`).

## Route

`src/app/api/internal/cron/company-watchlist/route.ts`. Auth via
`src/lib/internal-route-auth.ts` — requires `x-rolepatch-internal:
worker` header (set by the Worker's scheduled handler) and optionally
`x-rolepatch-internal-secret` for external triggers.

## What it does

For each signed-in user with active `company_watches`:

1. Fetch the company's career page (Greenhouse, Lever, Ashby, Workable,
   Recruitee, Personio, SmartRecruiters, or generic career page) via
   `src/lib/company-career-watch.ts`.
2. Normalise results into `DiscoveredJob` records.
3. Insert new jobs into `job_discovery_alerts` for the user.
4. Skip jobs already seen (URL-based dedup).

## Scope and limits

- **Signed-in only.** Company watches are a signed-in feature; guests
  use one-shot LinkedIn search instead.
- **Supported career URLs only.** Provider-aware selectors for
  Greenhouse, Lever, Ashby, Workable, Recruitee, Personio,
  SmartRecruiters, and generic career pages. Unsupported career pages
  are skipped.
- **No captcha bypass, no aggressive scraping.** If a career page
  blocks the Worker's datacenter IP, the watch silently skips that
  run and retries next hour.

See [ADR-0005](../../architecture/decisions/0005-linkedin-only-job-search.md)
for the broader job-search scope decision and
[the weekly digest job](weekly-digest.md) for the weekly companion.
