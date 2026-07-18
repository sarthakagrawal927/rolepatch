---
title: CI
---

# CI

GitHub Actions workflows live in `.github/workflows/`. Source of truth
for what runs — do not duplicate workflow YAML here.

## Workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| [`ci.yml`](../../.github/workflows/ci.yml) | push, PR | `pnpm lint` + `pnpm test` + `pnpm cf:build` |
| [`deploy.yml`](../../.github/workflows/deploy.yml) | push to `main`, PR, `workflow_dispatch` | `cf:build` + `wrangler deploy` + `pnpm smoke:prod` (production on `main`; preview build on PR) |
| [`job-sync.yml`](../../.github/workflows/job-sync.yml) | `workflow_dispatch` | Manual company-watchlist / weekly-digest cron trigger |
| [`weekly.yml`](../../.github/workflows/weekly.yml) | cron `0 9 * * 1`, `workflow_dispatch` | Weekly quality check (lint + typecheck + test + build) |
| [`docs.yml`](../../.github/workflows/docs.yml) | push, PR | `pnpm docs:check` (link + frontmatter + structure) |

## CI gates (`ci.yml`)

Runs on every push and PR. Steps:

1. `pnpm install --frozen-lockfile --ignore-scripts`
2. `pnpm lint` (Biome)
3. `pnpm test` (Vitest)
4. `pnpm cf:build` (full production build pipeline — see
   [development workflow](../development/workflow.md))

A failed `cf:build` blocks merge. The route verifier inside `cf:build`
catches missing parity-critical routes before deploy.

## Deploy workflow (`deploy.yml`)

- **Production:** on `push` to `main` or `workflow_dispatch`. Runs
  `cf:build` → `wrangler deploy` → `pnpm smoke:prod`.
- **Preview:** on PR. Runs `cf:build` only (no deploy, no smoke).

See [deploy](deploy.md) for the full publish path.

## Weekly quality (`weekly.yml`)

Cron `0 9 * * 1` (Monday 09:00 UTC) + `workflow_dispatch`. Runs lint,
typecheck, test, build if the scripts exist. Catches drift that
push-driven CI might miss (e.g. a dependency change that breaks the
build but didn't trigger a push).

## Docs (`docs.yml`)

Runs `pnpm docs:check` (link check + frontmatter + structure
validation). See [working on docs](../development/docs.md).
