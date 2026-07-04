# Project Recommendation Context

Generated: 2026-06-06T21:14:19.610Z

This file is a CodeVetter Repo Unpacked-inspired audit written for Starboard recommendations. It is intentionally local, evidence-oriented, and safe to commit: it records product context, feature areas, stack inventory, and recommendation guidance without secrets or environment values.

## Project Identity

- Slug: `resume-tailor`
- Registry description: RolePatch — AI-powered resume tailoring system.
- Product grouping: `public-ready`
- Source path: `resume-tailor`

## Product Context

RolePatch — AI-powered resume tailoring system.

RolePatch is an AI resume and job-application assistant. It helps users tailor resumes, generate cover letters, research companies, score role fit, prepare STAR stories, and run guest or signed-in application workflows.

RolePatch AI-powered resume tailoring. Paste a job URL, get a resume rewritten to match. Generate cover letters with company research, fit scores, and STAR interview stories. Deployment & External Services Concern Service --------- --------- Hosting Cloudflare Workers resume-tailor via @opennextjs/cloudflare — custom domain rolepatch.com Database Cloudflare D1 Auth better-auth + Google OAuth AI free-ai-gateway Workers AI chokepoint via Vercel AI SDK / OpenAI-compatible adapter Payments Dodo Payments CI/CD GitHub Actions — auto-deploy to Cloudflare on push to main PDF rendering uses the Cloudflare Workers Browser Rendering binding BROWSER . Stack Next.js 16 · React 19 · TypeScript · Tailwind 4

## Feature Map

- **Cloudflare and deploy**: Workers, Pages, edge runtime, queues, storage, and deploy automation. Keywords: cloudflare, worker, workers, pages, edge, deploy, wrangler, queue.
- **UI workflows**: Dashboards, tables, forms, component systems, charts, and user workflows. Keywords: ui, ux, dashboard, table, component, react, next, tailwind.
- **AI agents**: Agents, tool use, workflows, orchestration, RAG, evals, and model integration. Keywords: ai, agent, agents, llm, rag, embedding, eval, model.
- **Database and storage**: SQL, document storage, migrations, cache, queues, vectors, and persistence. Keywords: database, db, sql, sqlite, d1, cloudflare, drizzle.
- **Testing and quality**: Unit tests, browser tests, evals, CI quality gates, and regression checks. Keywords: test, testing, quality, vitest, playwright, ci, eval, benchmark.
- **Content and media**: Content production, video, reels, documents, markdown, and publishing workflows. Keywords: content, media, video, reel, markdown, document, publish, editor.
- **Repo intelligence**: Repository understanding, metadata enrichment, code review, and evidence reports. Keywords: review, static, analysis, diff, history, evidence, verification.

## Runtime Surfaces and Entrypoints

- `src/app/api/ai/models/route.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/extension/tailor/route.ts`
- `src/app/api/jobs/search/route.ts`
- `src/app/api/render/[id]/route.ts`
- `src/app/api/webhook/dodo-payments/route.ts`
- `src/app/badge/[slug]/page.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/app/blog/page.tsx`
- `src/app/cover-letter/[jobId]/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/editor/[id]/page.tsx`
- `src/app/evidence/page.tsx`
- `src/app/interview-prep/[jobId]/page.tsx`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/pricing/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/stash/page.tsx`
- `src/app/tailor/[jobId]/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/tools/ats-check/page.tsx`
- `src/app/tools/bullet-check/page.tsx`
- `src/app/tools/diff/layout.tsx`
- `src/app/tools/diff/page.tsx`
- `src/app/tools/keywords/layout.tsx`
- `src/app/tools/keywords/page.tsx`
- `src/app/tools/page.tsx`
- `src/app/tools/snippets/page.tsx`
- `src/app/tools/word-count/page.tsx`
- `worker.mjs`

## Current Stack

- Languages: `Astro`, `TypeScript`
- Frameworks/tools: `Astro`, `Cloudflare Workers`, `Next.js`, `OpenNext Cloudflare`, `Playwright`, `React`, `Tailwind CSS`, `Vitest`
- Config files:
- `landing-astro/astro.config.mjs`
- `landing-astro/wrangler.toml`
- `next.config.ts`
- `playwright.config.ts`
- `vitest.config.ts`
- `wrangler.toml`

## OSS Already In Use

Direct dependencies:
- `@ai-sdk/openai-compatible`
- `@astrojs/sitemap`
- `@cloudflare/puppeteer`
- `@codemirror/lang-markdown`
- `@codemirror/language`
- `@codemirror/state`
- `@codemirror/theme-one-dark`
- `@codemirror/view`
- `@dodopayments/nextjs`
- `@fontsource-variable/geist`
- `@mozilla/readability`
- `@saas-maker/ai`
- `@saas-maker/feedback`
- `@saas-maker/sdk`
- `@saas-maker/testimonials`
- `@sparticuz/chromium`
- `@tailwindcss/vite`
- `ai`
- `astro`
- `better-auth`
- `codemirror`
- `dodopayments`
- `linkedom`
- `lucide-react`
- `mammoth`
- `marked`
- `next`
- `pdf-parse`
- `posthog-js`
- `puppeteer-core`
- `react`
- `react-diff-viewer-continued`
- `react-dom`
- `react-markdown`
- `standardwebhooks`
- `tailwindcss`
- `uuid`
- `zod`

Development dependencies:
- `@axe-core/playwright`
- `@opennextjs/cloudflare`
- `@playwright/test`
- `@saas-maker/eslint-config`
- `@saas-maker/prettier-config`
- `@saas-maker/test-config`
- `@saas-maker/tsconfig`
- `@tailwindcss/postcss`
- `@testing-library/jest-dom`
- `@testing-library/react`
- `@testing-library/user-event`
- `@types/chrome`
- `@types/node`
- `@types/react`
- `@types/react-dom`
- `@types/uuid`
- `@vitejs/plugin-react`
- `babel-plugin-react-compiler`
- `beasties`
- `esbuild`
- `eslint`
- `eslint-config-next`
- `husky`
- `jsdom`
- `lightningcss`
- `tailwindcss`
- `typescript`
- `vitest`
- `wrangler`

Package scripts:
- `astro`
- `build`
- `bundle`
- `bundle:watch`
- `cf:build`
- `clean`
- `copy-static`
- `deploy`
- `dev`
- `lint`
- `prepare`
- `preview`
- `start`
- `test`
- `test:e2e`
- `test:watch`
- `typecheck`

## Testing and Quality Signals

- `__tests__/ats-score.test.ts`
- `__tests__/auth-guards.test.ts`
- `__tests__/bulk-rate-action.test.ts`
- `__tests__/extension-tailor-route.test.ts`
- `__tests__/jobs-search-route.test.ts`
- `__tests__/linkedin-search.test.ts`
- `__tests__/local-storage.test.ts`
- `__tests__/pdf.test.ts`
- `__tests__/share-score-action.test.ts`
- `e2e/mobile.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/resume-flow.spec.ts`
- `playwright.config.ts`
- `src/__tests__/ats-score.test.ts`
- `src/__tests__/fit-score-card.test.tsx`
- `src/__tests__/interview-prep.test.tsx`
- `src/__tests__/local-storage.test.ts`
- `src/lib/achievement-evidence.test.ts`
- `src/lib/application-campaign.test.ts`
- `vitest.config.ts`

## Recommendation Guidance

Good matches:
- Repos that strengthen cloudflare and deploy without replacing already-installed libraries.
- Repos that strengthen ui workflows without replacing already-installed libraries.
- Repos that strengthen ai agents without replacing already-installed libraries.
- Repos that strengthen database and storage without replacing already-installed libraries.
- Repos that strengthen testing and quality without replacing already-installed libraries.
- Repos that strengthen content and media without replacing already-installed libraries.
- Repos that strengthen repo intelligence without replacing already-installed libraries.
- Tools with concrete support for src, page.tsx, api, codemirror, route.ts, cloudflare, resume, guest.
- Implementation repos, SDKs, CLIs, testing utilities, adapters, and focused libraries are higher value than generic awesome lists.

Avoid recommending:
- Do not recommend packages already listed under direct or development dependencies unless the task is migration research.
- Do not recommend broad framework replacements unless the project context explicitly calls for a rewrite.
- Downrank curated lists, archived repos, stale demos, and generic UI kits that do not map to the feature catalog.

## Evidence Read

Primary docs and handoff files:
- `PROJECT_STATUS.md`
- `README.md`
- `agents.md`
- `docs/README.md`

Package manifests:
- `extension/package.json`
- `landing-astro/package.json`
- `package.json`

Inventory notes:
- Files scanned: 300
- This pass uses deterministic repo inventory plus local documentation/source-path evidence. It does not claim a full manual line-by-line review of every source file.

## Confidence

Confidence: **high**

Why:
- PROJECT_STATUS.md present
- README.md present
- 33 entrypoint/runtime files identified
- package dependencies inventoried
- 20 test/quality files identified

Refresh command:

```bash
cd /Users/sarthak/Desktop/fleet/starboard
pnpm fleet:audit-recommendation-context
pnpm fleet:extract-projects
```
