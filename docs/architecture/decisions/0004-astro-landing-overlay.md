---
title: ADR-0004 — Astro landing overlay on the Next.js build
---

# ADR-0004 — Astro landing overlay on the Next.js build

**Date:** 2026-06-20
**Status:** accepted

## Context

The `/` route is the LCP-critical marketing surface. The Next.js
Workers deploy re-renders the page every request and ships a React
runtime on the LCP path. The fleet reference Astro setup lands p75 LCP
≈ 360 ms on Cloudflare Pages with `output: 'static'`,
`inlineStylesheets: 'always'`, Lightning CSS, and Tailwind v4 — but
moving `/` to a separate Pages project would split routing across two
deploys and complicate the funnel (every downstream route still lives
on the Worker).

## Decision

Keep the Next.js Workers deploy as the single Worker for
`rolepatch.com/*`. During `pnpm cf:build`, after the Next.js + OpenNext
build, build the Astro landing (`landing-astro/`) and overlay its
`index.html` onto the OpenNext assets so `/` serves the static Astro
HTML. The Worker still owns `/dashboard/*`, `/editor/*`, `/tailor/*`,
`/api/*`, `/tools`, `/pricing`, `/privacy`, `/terms`.

The overlay scripts are `scripts/overlay-astro-landing.mjs` and
`scripts/run-overlay-astro-landing.mjs`. `wrangler.toml` sets
`run_worker_first = ["/*", "!/"]` so the assets binding serves `/`
directly without invoking the Worker.

## Consequences

- **Positive:** p75 LCP on `/` drops to Astro-on-Cloudflare-Pages
  territory without splitting the deploy. Single Worker, single zone
  config, single DNS.
- **Negative:** `cf:build` is now a multi-step pipeline (Next build →
  route verify → inline critical CSS → OpenNext build → cache populate
  → Astro build → overlay). A failure in any step blocks deploy.
- **Watch for:** The Astro landing must stay in sync with the Next.js
  landing's content (hero, features, footer). The Astro project has
  its own `wrangler.toml` and can be deployed independently to
  `resume-tailor-landing` Pages for preview, but production `/` is the
  overlay, not the Pages project. Do not delete `src/app/page.tsx`
  until the overlay is observably stable for ~a week.

## Alternatives considered

- **Move `/` to a separate Cloudflare Pages project** — rejected:
  splits routing across two deploys, complicates the funnel.
- **Keep Next.js `/` and accept the LCP** — rejected: psi-swarm showed
  the React runtime on the LCP path was the bottleneck.
- **Astro rewrite of the whole app** — rejected: server actions, API
  routes, and per-route caching need Next.js.
