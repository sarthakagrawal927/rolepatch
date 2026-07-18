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

## react-diff-viewer-continued for the tailoring diff
- What: Side-by-side diff view comparing the original resume against the AI-tailored version (markdown, not LaTeX)
- Why here: TBD
- Gotcha (from code): `src/components/resume-diff.tsx` and `src/app/tools/diff/page.tsx` use `react-diff-viewer-continued` directly (`DiffMethod.WORDS`) — it does NOT wrap Monaco. Monaco was evaluated and rejected; see [failed-approaches](../failed-approaches.md). The diff is separate from the CodeMirror editor used for editing.
- Source: https://github.com/Aeolun/react-diff-viewer-continued

## CodeMirror 6 for resume editing
- What: CodeMirror 6 with markdown language support for the resume editor (`/editor/[id]`)
- Why here: TBD
- Gotcha (from code): uses `@codemirror/lang-markdown` and `@codemirror/theme-one-dark`. Two distinct libraries in one app — CodeMirror for editing, react-diff-viewer-continued for the diff view. Monaco is not a dependency.
- Source: https://codemirror.net/

## Better-auth on Cloudflare Workers via OpenNext
- What: Running better-auth on Cloudflare Workers through OpenNext's Next.js compatibility layer
- Why here: TBD
- Gotcha (from code): auth route is `api/auth/[...all]` handler — OpenNext transforms the Next.js API route for the Workers runtime
- Source: https://www.better-auth.com/
