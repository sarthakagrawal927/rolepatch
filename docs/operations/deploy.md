---
title: Deploy
---

# Deploy

RolePatch deploys to Cloudflare Workers (`resume-tailor`) via
`@opennextjs/cloudflare`. Production deploys are triggered by push to
`main` (GitHub Actions `deploy.yml`) or `workflow_dispatch`. There is
no auto-deploy from PRs — PRs run `cf:build` only as a preview gate.

## Publish path

The approved publish flow (see
[the 2026-07-04 handoff notes](../archive/deploy-handoff-2026-07-04.md)
for the historical context):

1. **Local preflight:** `pnpm release:verify` — typecheck, Biome,
   Vitest, Chrome extension build, Cloudflare/OpenNext build, deploy
   route verifier, standalone local public smoke, focused
   desktop/mobile Playwright for dashboard / Add Job / tailor /
   receipts / settings. See [release verify](release-verify.md).
2. **Route verification:** `pnpm verify:deploy-routes` — verifies the
   built Next manifest contains parity-critical routes. Also runs
   inside `cf:build`.
3. **Build:** `pnpm cf:build` — the full multi-step production build
   pipeline (see [development workflow](../development/workflow.md)).
4. **Deploy:** `wrangler deploy` (via `pnpm deploy` locally, or the
   GitHub Actions `deploy.yml` on push to `main`).
5. **Post-deploy smoke:** `pnpm smoke:prod` — public + optional
   authenticated apply-agent read smoke. See
   [production smoke](production-smoke.md).

## GitHub Actions deploy workflow

`.github/workflows/deploy.yml`:

- **Production** (`push` to `main` or `workflow_dispatch`): `cf:build`
  → `wrangler deploy` (via `cloudflare/wrangler-action@v3` with
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets) →
  `pnpm smoke:prod`.
- **Preview** (`pull_request`): `cf:build` only.

Do not change secrets or production routing as part of a deploy unless
the user explicitly asks.

## After deploy

```bash
pnpm smoke:prod
```

Expected public checks: `/`, `/jobs`, `/pricing`, `/proof`,
`/api/proof/truehire-preview?handle=...` (guard), `/settings`. See
[production smoke](production-smoke.md) for the full list and the
authenticated apply-agent read smoke.

After production smoke passes, update `PROJECT_STATUS.md` with:

- commit or workflow run identifier
- deploy target
- `pnpm smoke:prod` result
- whether authenticated apply-agent read smoke was run

## Wrangler config

`wrangler.toml`:

- `name = "resume-tailor"`, `main = "worker.mjs"`.
- `compatibility_date = "2024-12-30"`, `compatibility_flags =
  ["nodejs_compat_v2"]`.
- `assets = { directory = ".open-next/assets", binding = "ASSETS",
  run_worker_first = ["/*", "!/"] }` — the assets binding serves `/`
  directly (the Astro overlay), the Worker handles everything else.
- `routes` for `rolepatch.com/*` and `www.rolepatch.com/*`.
- `[observability]` enabled, `head_sampling_rate = 0.1`.
- `[limits] cpu_ms = 30000`.
- `[triggers] crons` — hourly company-watchlist, weekly digest (see
  [jobs](jobs/)).
- `[[d1_databases]]` binding `DB`, database `rolepatch`.
- `[browser]` binding `BROWSER` for PDF export.
- `[vars]` `AI_BASE_URL`, `BETTER_AUTH_URL`, `NODE_ENV`.

## Out of scope for agent sessions

- Do not run `wrangler deploy` from agent sessions without explicit
  approval.
- Do not run D1 migrations without explicit approval.
- Do not change DNS, routes, or secrets.
