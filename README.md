# RolePatch

AI-powered resume tailoring. Paste a job URL, get a resume rewritten to match. Generate cover letters with company research, fit scores, and STAR interview stories.

## Deployment & External Services

| Concern | Service |
|---------|---------|
| Hosting | Cloudflare Workers (`resume-tailor`) via `@opennextjs/cloudflare` — custom domain `rolepatch.com` |
| Database | Cloudflare D1 |
| Auth | better-auth + Google OAuth |
| AI | free-ai-gateway (Workers AI chokepoint) via Vercel AI SDK / OpenAI-compatible adapter |
| Payments | Dodo Payments |
| CI/CD | GitHub Actions — auto-deploy to Cloudflare on push to `main` |

PDF rendering uses the Cloudflare Workers Browser Rendering binding (`BROWSER`).

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Cloudflare D1 · better-auth (Google) · Vercel AI SDK · CodeMirror · Playwright · Vitest

## Quick start

```bash
pnpm install
cp .env.example .env.local   # fill in values
pnpm dev                     # http://localhost:3000
```

Works fully as guest (localStorage). Sign in with Google to persist to Cloudflare D1.

## Scripts

```bash
pnpm dev           # next dev
pnpm build         # production build
pnpm start         # serve build
pnpm lint          # eslint
pnpm test          # vitest unit
pnpm test:e2e      # playwright
```

## Env

See `.env.example`. Required for full use:

- Cloudflare D1 binding `DB` in `wrangler.toml` — signed-in persistence
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — OpenAI-compatible AI provider
- `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth via better-auth
- `DODO_PAYMENTS_*`, `DODO_PRODUCT_*` — token purchases (optional)
- `NEXT_PUBLIC_SAASMAKER_API_KEY` — feedback/analytics (optional)

## Layout

- `src/app/` — routes (landing, dashboard, editor, tailor, cover-letter, stash, settings)
- `src/lib/actions/` — server actions (CRUD, AI, scraping)
- `src/lib/local-storage.ts` — guest data layer
- `src/components/` — client UI
- `__tests__/` — vitest · `e2e/` — playwright
- `src/lib/job-search.ts` — native in-Worker job search (LinkedIn)

More in `agents.md`.

## Job discovery

Live job search runs natively in the Worker — `src/lib/job-search.ts` queries
LinkedIn's public guest job-search endpoint (no API key) and normalises the
results for the job-discovery UI. The Next.js route
`src/app/api/jobs/search/route.ts` calls it directly.

Scope: LinkedIn only. The former multi-board Python sidecar (`api/python/`,
which wrapped [python-jobspy](https://github.com/speedyapply/JobSpy)) was
removed — Cloudflare Workers has no Python runtime. If LinkedIn rate-limits
the Worker's datacenter IP, the fallback is Cloudflare Browser Rendering or a
hosted job-search API.

## Deploy

Cloudflare Workers via OpenNext. `pnpm deploy` builds `.open-next/worker.js`
and deploys the Worker/routes configured in `wrangler.toml` for `rolepatch.com`.

<!-- ACTIVE-AI-TASK-LOG:START -->
## Active AI Task Log

This section is maintained by the SaaS Maker Active-AI product/design loop so future agents do not reopen duplicate UI tasks.

- Business lane: Core/status context
- Rule: do not create another broad "improve the UI" task unless the acceptance criteria differ materially from the tasks listed here.
- Source of truth for task status: SaaS Maker task board. README entries are durable context only.

- No current Active-AI product/design task from the 2026-05-25/26 loop. Treat this as watch/status unless new evidence appears.
<!-- ACTIVE-AI-TASK-LOG:END -->
