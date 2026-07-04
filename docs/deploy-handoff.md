# Deploy Handoff

Date: 2026-07-04

This is the publish checklist for the apply-agent/proof/UI parity slice.

## Current State

- Local release preflight passed with `pnpm release:verify` on 2026-07-04
  23:32 IST.
- Production at `https://rolepatch.com` is stale until the verified local slice
  is committed, pushed, and deployed.
- Latest public production smoke remains 2/6: `/` and `/pricing` pass; `/jobs`,
  `/proof`, `/api/proof/truehire-preview`, and current `/settings` readiness are
  not live yet.
- Symphony deploy follow-up: `4847b8bf`.
- TrueHire proof-project follow-up: `2d15f69c`.

## Before Publish

```bash
pnpm release:verify
```

Expected coverage:

- TypeScript
- Biome
- Vitest
- Chrome extension build
- Cloudflare/OpenNext build
- Deploy route verifier
- Standalone local public smoke
- Focused desktop/mobile Playwright for dashboard, Add Job, tailor, receipts,
  and settings readiness

## Publish Path

Use the approved Fleet publish flow. Do not change secrets or production routing
as part of this deploy.

The GitHub deploy workflow now supports:

- `push` to `main`
- `workflow_dispatch`
- PR build preview through `pull_request`

The workflow runs `pnpm cf:build`, deploys with Wrangler, then runs
`pnpm smoke:prod`.

## After Deploy

```bash
pnpm smoke:prod
```

Expected public checks:

- `/`
- `/jobs`
- `/pricing`
- `/proof`
- `/api/proof/truehire-preview?handle=https%3A%2F%2Fevil.test%2Fx`
- `/settings`

Optional authenticated read-only smoke:

```bash
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm smoke:prod
```

Never commit cookies or secrets.

## Completion Evidence

After production smoke passes, update `PROJECT_STATUS.md` with:

- commit or workflow run identifier
- deploy target
- `pnpm smoke:prod` result
- whether authenticated apply-agent read smoke was run
