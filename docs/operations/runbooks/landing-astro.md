---
title: Landing-astro overlay runbook
---

# Landing-astro overlay runbook

The Astro landing (`landing-astro/`) is a static port of the
`rolepatch.com` `/` route. During `pnpm cf:build`, its `index.html` is
overlaid onto the OpenNext assets so `/` serves the static Astro HTML
instead of the Next.js-rendered page. See
[ADR-0004](../../architecture/decisions/0004-astro-landing-overlay.md)
for why.

## Why a separate Astro project?

The landing is fully static: no DB, no auth, no per-user content. The
Next.js Workers deploy re-renders the page every request and ships a
React runtime on the LCP path. The Astro setup lands p75 LCP ≈ 360 ms
on Cloudflare Pages with `output: 'static'`,
`inlineStylesheets: 'always'`, Lightning CSS, and Tailwind v4.

## Stack

- Astro 5, `output: 'static'`
- Tailwind v4 via `@tailwindcss/vite`
- Lightning CSS transformer + minifier
- `@astrojs/sitemap`
- No SSR adapter, no React, no client JS

## Commands

```bash
cd landing-astro
pnpm install
pnpm dev      # astro dev → http://localhost:4321
pnpm build    # static HTML → dist/
pnpm preview  # serve dist/ locally
pnpm deploy   # wrangler pages deploy dist/ → resume-tailor-landing (preview only)
```

## Overlay mechanism

`scripts/overlay-astro-landing.mjs` copies the Astro `dist/index.html`
(and supporting assets) into `.open-next/assets/` so the Workers
assets binding serves it for `/`. `scripts/run-overlay-astro-landing.mjs`
is the wrapper invoked by `pnpm cf:build` after the Astro build.

`wrangler.toml` sets `run_worker_first = ["/*", "!/"]` so the assets
binding serves `/` directly without invoking the Worker. The Worker
still owns every downstream funnel route (`/dashboard/*`, `/editor/*`,
`/tailor/*`, `/api/*`, `/tools`, `/pricing`, `/privacy`, `/terms`).

## Content sync

The Astro landing must stay in sync with the Next.js landing's content
(hero, features, footer). The Next.js `src/app/page.tsx` is kept as a
fallback; do not delete it until the overlay is observably stable for
~a week.

## Compromises vs. the Next.js original

- **Lucide icons** — React `<Award />` / `<Zap />` are inlined as SVG
  paths in `src/components/Icon.astro`.
- **Next.js `<Link>` → plain `<a>`** — the Worker still owns every
  downstream route, so internal links resolve unchanged.
- **Footer year** — `new Date().getFullYear()` is evaluated in Astro
  frontmatter, baked at build time. Re-deploy each January.
- **Analytics / auth wrappers** — skipped on the landing; the Worker
  still owns every downstream funnel route, so conversion events fire
  on the Worker side. Add a PostHog `<script>` to `Layout.astro` later
  if upper-funnel attribution matters.
- **OG image** — both Next.js and Astro metadata point at the stable
  raster asset `https://rolepatch.com/og-image.png`; the Worker still
  owns that asset post-cutover.

## Independent Pages preview

The Astro project has its own `wrangler.toml` and can be deployed
independently to the `resume-tailor-landing` Cloudflare Pages project
for preview. **Production `/` is the overlay, not the Pages project.**
Do not route `rolepatch.com/` to the Pages project without explicit
approval — that is a DNS / routing change.
