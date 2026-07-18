---
title: Release verify (local preflight)
---

# Release verify (local preflight)

`pnpm release:verify` is the local preflight before publish. It runs
the full quality + build gate and a focused Playwright slice against
the standalone built server.

## Steps

`scripts/release-verify.mjs` runs, in order:

1. `pnpm typecheck` — `tsc --noEmit`
2. `pnpm lint` — Biome check
3. `pnpm test` — Vitest unit tests
4. `pnpm --dir extension build` — Chrome extension build
5. `pnpm cf:build` — full production build pipeline (see
   [development workflow](../development/workflow.md))
6. **Standalone server smoke** — copies `.next/static` and `public`
   into `.next/standalone`, starts `.next/standalone/server.js` on
   port 3011 (override with `ROLEPATCH_RELEASE_VERIFY_PORT`), waits
   for it to be ready, then runs `pnpm smoke:local` against it.
7. **Focused Playwright** — `playwright test` on
   `e2e/ats-job-flow.spec.ts` and `e2e/settings-readiness.spec.ts`
   with `--workers=1`.

The verifier copies static assets into the standalone server dir so
the preview exercises hydrated client interactions instead of
server-rendered HTML alone.

## When to run

- Before any manual `pnpm deploy`.
- Before a push to `main` that you expect to trigger a production
  deploy.
- The GitHub Actions `deploy.yml` runs `pnpm cf:build` (steps 1–5 of
  the build pipeline) before `wrangler deploy` and `pnpm smoke:prod`
  after, so `release:verify` is the local mirror of the CI gate plus
  the focused Playwright slice CI does not run.

## Failure handling

A failure in any step aborts the run. Fix the failure and re-run from
the top — the script is not incremental. The standalone server is
cleaned up on exit.
