# landing-astro

Static Astro port of the rolepatch.com `/` route. Deploys to Cloudflare
Pages, intended to take over `/` from the Next.js Workers deploy once
verified.

## Why a separate project?

The landing is fully static: no DB, no auth, no per-user content. The
Next.js Workers deploy re-renders the page every request and ships a
React runtime on the LCP path. The reference Astro setup at
`fleet/sarthakagrawal/` lands p75 LCP ≈ 360 ms on Cloudflare Pages;
this project mirrors that config (`output: 'static'`,
`inlineStylesheets: 'always'`, Lightning CSS transformer + minifier,
Tailwind v4 via the official Vite plugin).

## Stack

- Astro 5 — `output: 'static'`
- Tailwind v4 via `@tailwindcss/vite` (fleet web-stack standard, see
  `../../AGENTS.md` → "Fleet web stack standard")
- Lightning CSS — transformer + minifier
- `@astrojs/sitemap`
- Cloudflare Pages — see `wrangler.toml` (`pages_build_output_dir =
  "dist"`)

No SSR adapter, no React, no client JS. Lucide icons are inlined as
SVG strings via `src/components/Icon.astro` — the React source imported
`lucide-react`.

## Commands

```bash
pnpm install
pnpm dev      # astro dev → http://localhost:4321
pnpm build    # static HTML → dist/
pnpm preview  # serve dist/ locally
pnpm deploy   # wrangler pages deploy dist/ → resume-tailor-landing
```

## Structure

```
landing-astro/
  astro.config.mjs          # output: 'static', inlineStylesheets,
                            # Lightning CSS, Tailwind v4 Vite plugin.
  wrangler.toml             # CF Pages, pages_build_output_dir = "dist".
  src/
    pages/index.astro       # The landing page — hero, features, how,
                            # before/after proof, footer.
    layouts/Layout.astro    # Meta tags, OG, async-CSS Geist font load,
                            # JSON-LD SoftwareApplication schema.
    components/
      Icon.astro            # Inline lucide SVG paths (10 icons).
    styles/global.css       # @import "tailwindcss" + :root CSS vars
                            # (--accent, --border, --muted, ...) ported
                            # from src/app/globals.css.
  public/_headers           # CF Pages cache + security headers.
```

## Compromises vs. the Next.js original

- **Lucide icons** — React `<Award />` / `<Zap />` / etc. are inlined as
  SVG paths in `src/components/Icon.astro`. Stroke-width and viewBox
  match lucide defaults; the visual match is exact.
- **Next.js `<Link>` → plain `<a>`** — the Worker still owns `/dashboard`,
  `/tools`, `/pricing`, `/privacy`, `/terms`, so internal links resolve
  unchanged. `prefetch={false}` on the React side was already disabling
  client-side prefetch; an `<a>` is a strict superset of that behaviour.
- **`new Date().getFullYear()` footer year** — evaluated in the Astro
  frontmatter, so it's baked at build time. Re-deploy each January (or
  set up a cron deploy if it ever matters).
- **`SiteNav` from `src/app/layout.tsx`** — not visible on the landing
  page (page.tsx renders its own `<header>`), so it wasn't ported.
- **`AnalyticsProvider` / `SaasMakerAnalytics` / `SaaSMakerFeedback` /
  `AuthProvider`** — all skipped. These wrappers don't render any
  visible markup on `/`; the Worker still owns every downstream funnel
  route, so conversion events still fire on the Worker side. Add a
  PostHog `<script>` to `Layout.astro` later if upper-funnel
  attribution turns out to matter.
- **OG image** — Next.js and Astro metadata point OG/Twitter previews at the
  stable raster asset `https://rolepatch.com/og-image.png`;
  the Worker still owns that asset post-cutover so the URL resolves.

## Cutover (NOT done yet)

This deploy is **additive**. The Next.js Workers deploy at
`rolepatch.com` is untouched: same `wrangler.toml`, same `package.json`,
same routes. Cutover is a follow-up step:

1. `cd landing-astro && pnpm install && pnpm build` — verify clean.
2. `pnpm deploy` — push to Pages preview URL. QA against the Next.js
   version.
3. In the Cloudflare dashboard, route `rolepatch.com/` (exact) → the
   `resume-tailor-landing` Pages project, leave `rolepatch.com/*` on
   the Worker. Verify the Worker still owns `/dashboard/*`,
   `/editor/*`, `/tailor/*`, `/api/*`, `/tools`, `/pricing`,
   `/privacy`, `/terms`.
4. Run psi-swarm against `rolepatch.com/`, confirm LCP < 500 ms p75
   desktop.
5. Delete `src/app/page.tsx` from the resume-tailor root **only after**
   the route is observably stable for ~a week.

Do not delete the React landing until the Pages route is the source of
truth in production.
