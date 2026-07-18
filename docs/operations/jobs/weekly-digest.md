---
title: Weekly digest job
---

# Weekly digest job

Weekly cron that sends signed-in users a digest of new saved-search /
company-watch matches and apply-agent queue / receipt activity.

## Schedule

- **Cron:** `0 14 * * 1` (Monday 14:00 UTC) — configured in
  `wrangler.toml` `[triggers] crons`.
- **Dispatch:** `worker.mjs` matches `event.cron` against
  `SCHEDULED_TASKS` and dispatches a subrequest to
  `/api/internal/cron/weekly-digest` with the
  `x-rolepatch-internal: worker` header.
- **Manual trigger:** GitHub Actions `job-sync.yml` with the
  `weekly-digest` input.

## Route

`src/app/api/internal/cron/weekly-digest/route.ts`. Auth via
`src/lib/internal-route-auth.ts`.

## What it does

For each signed-in user with activity in the past week:

1. Gather new saved-search / company-watch matches from
   `job_discovery_alerts`.
2. Gather apply-agent queue and receipt activity (ready, blocked,
   filled, submitted, recent ATS progress).
3. Render a weekly recap email.
4. Send via Resend if `RESEND_API_KEY` is set; **fail closed** (skip
   sending, log, exit 0) if the key is unset. Never crash the cron on
   a missing email key.

## Scope

- **Signed-in only.** Guests have no server-side email address.
- **Resend is optional.** The cron is a no-op without
  `RESEND_API_KEY`. This is intentional — the email path is
  opt-in infrastructure, not a hard dependency.
- **No unattended apply.** The digest reports apply-agent activity;
  it never submits applications. See
  [ADR-0003](../../architecture/decisions/0003-apply-agent-review-first.md).
