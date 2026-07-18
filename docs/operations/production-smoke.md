---
title: Production smoke checks
---

# Production smoke checks

RolePatch ships a dependency-free production smoke harness for Cloudflare-first
runtime checks.

## Public Smoke

For the complete publish checklist, see the [deploy runbook](deploy.md).

Before deploying manually, verify that the built Next artifact contains the
routes the smoke will check:

```bash
pnpm build
pnpm verify:deploy-routes
```

For the full local non-deploy release preflight, run:

```bash
pnpm release:verify
```

This runs typecheck, lint, unit tests, extension build, Cloudflare build, local
public smoke against the standalone built server, and the focused desktop/mobile
Playwright flow used for the apply-agent proof slice. The verifier copies
`.next/static` and `public` into `.next/standalone` before starting
`.next/standalone/server.js`, so the preview exercises hydrated client
interactions instead of server-rendered HTML alone.

`pnpm cf:build` runs the same route verification immediately after
`next build --webpack`, before OpenNext or `wrangler deploy` can proceed.

The GitHub deploy workflow also runs `pnpm cf:build` before `wrangler deploy`
and `pnpm smoke:prod` after deployment. Production deploys run on `main` pushes
and can be started manually with `workflow_dispatch`.

```bash
pnpm smoke:prod
```

Defaults to `https://rolepatch.com` and checks:

- `/`
- `/jobs`
- `/pricing`
- `/proof`
- `/api/proof/truehire-preview?handle=https%3A%2F%2Fevil.test%2Fx` (guard check)
- `/settings`

The script verifies status codes and key page text. It does not mutate data.
The public suite currently has 6 checks.

As of 2026-07-04, the current local build passes this smoke suite against a
built local server, but `https://rolepatch.com` is still stale until the verified
apply-agent/proof slice is deployed. Symphony task `4847b8bf` tracks that
deployment follow-up.

## Authenticated Apply-Agent Smoke

```bash
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm smoke:prod
```

When a session cookie is supplied, the same smoke run also checks read-only
apply-agent API routes:

- `/api/apply-agent/queue`
- `/api/apply-agent/packets`
- `/api/apply-agent/receipts`

Do not commit cookies or secrets. Copy a current browser session cookie only for
the terminal session running the smoke.
With a session cookie, the full suite currently has 9 checks.

## Alternate Targets

```bash
ROLEPATCH_SMOKE_BASE_URL=https://staging.example.com pnpm smoke:prod
pnpm smoke:local
```

`pnpm smoke:local` targets `http://localhost:3000`.
