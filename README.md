# RolePatch

AI-powered resume tailoring. Paste a job URL, get a resume rewritten to match. Generate cover letters with company research, fit scores, and STAR interview stories.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Turso (libsql) · NextAuth (Google) · Vercel AI SDK · CodeMirror · Playwright · Vitest

## Quick start

```bash
pnpm install
cp .env.example .env.local   # fill in values
pnpm dev                     # http://localhost:3000
```

Works fully as guest (localStorage). Sign in with Google to persist to Turso.

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

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — signed-in persistence
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — OpenAI-compatible AI provider
- `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `DODO_PAYMENTS_*`, `DODO_PRODUCT_*` — token purchases (optional)
- `NEXT_PUBLIC_SAASMAKER_API_KEY` — feedback/analytics (optional)

## Layout

- `src/app/` — routes (landing, dashboard, editor, tailor, cover-letter, stash, settings)
- `src/lib/actions/` — server actions (CRUD, AI, scraping)
- `src/lib/local-storage.ts` — guest data layer
- `src/components/` — client UI
- `__tests__/` — vitest · `e2e/` — playwright

More in `agents.md`.

## Deploy

Vercel. `pnpm build` green, pre-push hook runs lint + secret scan.
