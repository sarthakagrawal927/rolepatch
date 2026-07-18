---
title: ADR-0001 — Cloudflare Workers via OpenNext
---

# ADR-0001 — Cloudflare Workers via OpenNext

**Date:** 2026-02-23
**Status:** accepted

## Context

RolePatch needs server-side rendering (server actions, API routes,
per-route caching) but the fleet standard is Cloudflare Workers for
hosting. Next.js on Workers requires a compatibility layer because
Workers is not a Node.js runtime. The AI provider must be swappable
between the Fleet-wide free-ai-gateway (Workers AI chokepoint with
daily Neuron budget), local AI, and BYOK.

## Decision

Deploy Next.js 16 to Cloudflare Workers via `@opennextjs/cloudflare`.
Use a single OpenAI-compatible AI adapter (`src/lib/ai.ts`,
`src/lib/ai-cloudflare.ts`) with a swappable `baseURL`. Production
routes all AI traffic through `https://ai-gateway.sassmaker.com/v1`
via the `AI_BASE_URL` var in `wrangler.toml`.

## Consequences

- **Positive:** One deploy target, one runtime, no Node server to
  manage. Edge cache for marketing pages. Browser Rendering binding
  for PDF export without a separate puppeteer service.
- **Negative:** No Python runtime — the JobSpy multi-board job-search
  sidecar had to be removed (see
  [ADR-0005](0005-linkedin-only-job-search.md)). Node compatibility is
  via `nodejs_compat_v2` flag, not full Node.
- **Watch for:** OpenNext overrides must be re-evaluated on Next.js
  major bumps. The custom `worker.mjs` entry must re-export OpenNext
  Durable Objects or bindings fail at deploy.

## Alternatives considered

- **Vercel** — rejected: fleet standard is Cloudflare, and Vercel
  would split hosting across two platforms.
- **Next.js on Node + Cloudflare Pages Functions** — rejected: server
  actions and full SSR are cleaner on Workers via OpenNext than on
  static export + Functions.
- **Native Gemini SDK** — rejected: a single OpenAI-compatible adapter
  is swappable across providers; a native SDK locks the app to one
  vendor. (The 2026-03-16 token-system spec proposed native Gemini;
  the adapter pattern won.)
