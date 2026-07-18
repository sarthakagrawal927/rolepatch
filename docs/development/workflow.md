---
title: Development workflow
---

# Development workflow

## Prerequisites

- Node.js 22+ (CI uses 22.19).
- pnpm 10+ (the repo pins `pnpm@10.33.2` via `packageManager`).
- Cloudflare account + `wrangler` for D1 / Workers / Browser Rendering
  (production deploys only — local dev does not need wrangler).

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in values for full app; guest mode works without
pnpm dev                     # http://localhost:3000
```

Guest mode works without any env vars. Signed-in flows need
`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
the D1 binding (production only — local dev uses guest mode or
`wrangler d1` for D1 testing).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next dev server → http://localhost:3000 |
| `pnpm build` | `next build --webpack` (production build) |
| `pnpm start` | `next start` (Node preview; not the production runtime) |
| `pnpm cf:build` | Next build → route verify → inline critical CSS → OpenNext build → cache populate → Astro build → overlay. **This is the production build path.** |
| `pnpm deploy` | `cf:build` + `wrangler deploy` |
| `pnpm lint` / `pnpm check` | Biome check (`biome check .`) |
| `pnpm format` | Biome format --write |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm test:coverage` | Vitest with v8 coverage |
| `pnpm test:watch` | Vitest watch |
| `pnpm test:e2e` | Playwright e2e |
| `pnpm release:verify` | Full local preflight (see [release verify](../operations/release-verify.md)) |
| `pnpm smoke:prod` | Production smoke (see [production smoke](../operations/production-smoke.md)) |
| `pnpm smoke:local` | Smoke against http://localhost:3000 |
| `pnpm verify:deploy-routes` | Verify built Next manifest contains parity-critical routes |
| `pnpm docs:check` | Docs link + frontmatter + structure validation |
| `pnpm docs:build` | Blume build → `dist/` (presentation layer) |
| `pnpm apply-agent` | Apply-agent CLI (see [runbook](../operations/runbooks/apply-agent-cli.md)) |
| `pnpm apply-agent:mcp` | Apply-agent MCP stdio server |

## Build path (`pnpm cf:build`)

The production build is a multi-step pipeline. A failure in any step
blocks deploy:

1. `next build --webpack` — Next.js production build. `--webpack` is
   required (Turbopack had issues with the OpenNext + static assets
   path).
2. `node scripts/verify-deploy-routes.mjs` — verifies the built Next
   manifest contains parity-critical routes (see
   [release verify](../operations/release-verify.md)).
3. `node scripts/run-inline-critical-css.mjs` — Beasties inline critical
   CSS into prerendered HTML.
4. `opennextjs-cloudflare build --skipNextBuild` — OpenNext build.
5. `opennextjs-cloudflare populateCache local` — populate the
   incremental cache (static-assets-incremental-cache).
6. `pnpm --filter ./landing-astro build` — build the Astro landing.
7. `node scripts/run-overlay-astro-landing.mjs` — overlay Astro
   `index.html` onto OpenNext assets for `/`.

See [ADR-0004](../architecture/decisions/0004-astro-landing-overlay.md)
for why the overlay exists.

## Testing

- **Vitest** (`vitest.config.ts`) — unit tests in `__tests__/`. Vitest
  installs and resets a deterministic `localStorage` before each test
  to prevent guest-mode state leakage between suites (2026-07-11
  isolation fix).
- **Playwright** (`playwright.config.ts`) — e2e tests in `e2e/`. Used
  for the apply-agent proof slice and dashboard / tailor / receipts /
  settings flows.
- **Coverage** is intentionally light; manual smoke covers add /
  refresh / export flows. Add focused unit tests when adding logic with
  parseable contracts (ATS scoring, AI model setup, apply-agent answer
  matching).

## Lint / format

- **Biome** (`biome.json`) is the only linter + formatter. Run
  `pnpm lint` or `pnpm check`.
- Husky pre-commit runs lint-staged; `prepare` hook installs husky on
  `pnpm install`.

## Env vars

All env vars are documented in `.env.example`. Required for full use:

- Cloudflare D1 binding `DB` in `wrangler.toml` — signed-in persistence.
- `AI_BASE_URL`, `AI_GATEWAY_API_KEY`, `AI_MODEL` — AI provider
  (defaults to free-ai-gateway).
- `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` —
  Google OAuth via better-auth.
- `DODO_PAYMENTS_*`, `DODO_PRODUCT_*` — token purchases.
- `NEXT_PUBLIC_SAASMAKER_API_KEY` — feedback widget (optional).
- `RESEND_API_KEY` — weekly digest sending (optional, fails closed).
- `RAG_SERVICE_KEY`, `ROLEPATCH_RAG_INDEX_ID` — Knowledgebase semantic
  similarity (optional).

Never commit secrets. `.env*` is gitignored (except `.env.example`).

## Chrome extension

The extension is a separate workspace package (`extension/`, package
name `@rolepatch/extension`). Build with `pnpm --dir extension build`
(the command `scripts/release-verify.mjs` runs) → `extension/dist/`.
Load unpacked in Chrome. See the
[extension README](https://github.com/sarthak-fleet/rolepatch/blob/main/extension/README.md).
