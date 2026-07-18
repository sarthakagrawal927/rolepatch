---
title: Learnings — study queue
---

# new-things — study queue

Short stubs for non-standard tech in this repo. 3–5 lines each. Fill `Why here:`
yourself after learning; never invent rationale.

## Jina Reader scraping with fallback
- What: Primary scraper using Jina Reader API, falling back to direct fetch + linkedom + Mozilla Readability
- Why here: TBD
- Gotcha (from code): `src/lib/actions/scrape-action.ts:107-126` — Jina Reader is tried first with `Accept: text/markdown`; if it fails, falls back to full HTML parsing with Readability
- Source: https://jina.ai/reader

## Guest mode localStorage layer
- What: Full app works without auth via localStorage — a drop-in replacement for DB operations with the same interface
- Why here: TBD
- Gotcha (from code): `src/lib/local-storage.ts:22-46` — `getItems`/`setItems` are generic helpers that mirror the DB layer interface, so server actions can swap between DB and localStorage
- Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

## AI SDK adapter pattern with swappable baseURL
- What: Single adapter that talks to any OpenAI-compatible endpoint via `baseURL` swap — BYO key or free gateway
- Why here: TBD
- Gotcha (from code): `src/lib/ai-cloudflare.ts:50-55` — if user provides `endpointUrl + apiKey`, use that (BYO); otherwise route through free-ai-gateway with `x-gateway-project-id` header
- Source: https://sdk.vercel.ai/docs

## Monaco diff editor for LaTeX
- What: Using Monaco (VS Code's editor) for side-by-side diff view comparing original vs AI-tailored LaTeX
- Why here: TBD
- Gotcha (from code): uses `react-diff-viewer-continued` which wraps Monaco — diff is side-by-side with line highlighting, separate from the CodeMirror editor used for editing
- Source: https://microsoft.github.io/monaco-editor/

## CodeMirror 6 for LaTeX editing
- What: Using CodeMirror 6 with markdown language support for the actual LaTeX editor — separate from Monaco which is only for diff view
- Why here: TBD
- Gotcha (from code): uses `@codemirror/lang-markdown` and `@codemirror/theme-one-dark` — two different editors in one app (CodeMirror for editing, Monaco for diff)
- Source: https://codemirror.net/

## Better-auth on Cloudflare Workers via OpenNext
- What: Running better-auth on Cloudflare Workers through OpenNext's Next.js compatibility layer
- Why here: TBD
- Gotcha (from code): auth route is `api/auth/[...all]` handler — OpenNext transforms the Next.js API route for the Workers runtime
- Source: https://www.better-auth.com/
