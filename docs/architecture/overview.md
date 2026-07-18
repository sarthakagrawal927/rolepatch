---
title: Architecture overview
---

# Architecture overview

RolePatch is a Next.js 16 App Router app deployed to Cloudflare Workers
via `@opennextjs/cloudflare`. The committed Markdown here is the source
of truth for topology and non-obvious constraints; code is authoritative
for implementation details.

## Topology

```
                    rolepatch.com (Cloudflare zone)
                              │
              ┌───────────────┴───────────────┐
              │  worker.mjs (custom entry)     │
              │  ┌──────────────────────────┐  │
              │  │ OpenNext worker (Next)   │  │
              │  │  - server actions        │  │
              │  │  - API routes            │  │
              │  │  - edge cache consult    │  │
              │  └──────────────────────────┘  │
              │   bindings: DB (D1), BROWSER    │
              │   assets: ASSETS (static)       │
              └───────────────┬───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   Cloudflare D1        Browser Rendering      Email Routing
   (signed-in data)     (PDF export)          (recruiter replies)
                              │
              ┌───────────────┴───────────────┐
              │  External services            │
              │  - free-ai-gateway (AI)       │
              │  - Dodo Payments              │
              │  - Google OAuth               │
              │  - Jina Reader (scraping)     │
              │  - LinkedIn guest job API     │
              │  - Knowledgebase RAG (fleet)  │
              │  - PostHog (analytics)        │
              └───────────────────────────────┘
```

## Worker entry (`worker.mjs`)

The custom Worker entry wraps the OpenNext-generated worker
(`./.open-next/worker.js`) and adds three things the generated worker
does not:

1. **Edge cache for cacheable document paths.** For anonymous GET
   requests (requests carrying a better-auth session cookie skip the
   cache) to `/`, `/pricing`, `/proof`, `/evidence`, `/tools`, `/blog`,
   `/privacy`, `/terms` (and `/tools/*`, `/blog/*`), the Worker consults
   `caches.default` first and only falls through to the Next handler on
   a miss. Cache headers are explicit
   (`public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`)
   so CF Edge treats the response as cacheable. **Why:** the
   s-maxage-only approach was getting marked DYNAMIC at the zone level;
   `caches.default` sidesteps the zone-level Cache Rules requirement.
   Anonymous GET `/` is special-cased: it is served straight from the
   `ASSETS` binding (the overlaid Astro `index.html`) and gzip-compressed
   inline, bypassing OpenNext entirely.
2. **Scheduled task dispatch.** `event.cron` matches
   `SCHEDULED_TASKS` (company-watchlist hourly, weekly-digest weekly) and
   dispatches to `/api/internal/cron/*` via internal subrequests with
   `x-rolepatch-internal: worker` header.
3. **Durable Object re-exports.** OpenNext's `DOQueueHandler`,
   `DOShardedTagCache`, `BucketCachePurge` must be re-exported from the
   entry that `wrangler.toml` points at, otherwise the bindings can't
   resolve them at deploy time.

All non-GET, non-cacheable requests pass straight through to OpenNext.
`withTiming` wraps the fetch handler for observability;
`handleAgentEdge` serves `llms.txt`, `llms-full.txt`, `/api/ai`, and
agent-indexing surfaces. The entry also exports an `email()` handler
that ingests inbound recruiter replies (Cloudflare Email Routing) by
POSTing to `/api/internal/email/recruiter-reply`.

## OpenNext incremental cache

`open-next.config.ts` uses `staticAssetsIncrementalCache` — CF Workers
Static Assets as the incremental cache. This is the right override when
the app is fully prerendered (no runtime revalidation): OpenNext serves
prerendered HTML from the assets binding instead of re-rendering the
React tree on every request. **Crucially, this is what makes the
Beasties-modified HTML (with inline critical CSS) actually reach the
browser** — without an incremental cache the runtime re-renders from
`page.js` and the inlined CSS is lost.

## Dual runtimes: guest vs signed-in

The full app works without auth via `localStorage`
(`src/lib/local-storage.ts`). Signed-in users persist to Cloudflare D1
with `user_id` filtering. Server actions in `src/lib/actions/` call
`getCurrentUserId()` from `src/lib/auth-utils.ts` and branch on null:

- **Guest (null userId):** read/write against `localStorage` via the
  generic `getItems` / `setItems` helpers that mirror the DB layer
  interface. Guest writes never touch D1 — see
  [the security audit](../knowledge/security-audit.md) for the
  historical leak that motivated this.
- **Signed-in:** D1 with `WHERE user_id = ?` filtering on every query.

See [data model](data-model.md) for the schema and the guest parity
contract, and [ADR-0002](decisions/0002-guest-localstorage-parity.md)
for why this dual layer exists.

## AI provider

Single adapter in `src/lib/ai.ts` (and `src/lib/ai-cloudflare.ts`) —
supports the free-ai-gateway, local AI, or BYOK via `baseURL` swap. All
production AI traffic routes through `https://ai-gateway.sassmaker.com/v1`
(the Fleet-wide Workers AI chokepoint with daily Neuron budget) via the
`AI_BASE_URL` var in `wrangler.toml`. BYOK: if a user supplies
`endpointUrl + apiKey`, the adapter uses that and sends
`x-gateway-project-id` header otherwise. See
[ADR-0001](decisions/0001-cloudflare-workers-opennext.md) for the
runtime constraint that drove this.

## Scraping

`src/lib/actions/scrape-action.ts` tries Jina Reader first
(`Accept: text/markdown`), then falls back to direct fetch + `linkedom`
+ `@mozilla/readability`. SSRF validation blocks private/reserved IPs,
`localhost`, `file://`, and cloud metadata endpoints — see
[the security audit](../knowledge/security-audit.md). There is no broad
rate limiter by policy; prefer SSRF validation, ownership/auth checks,
and provider cost controls.

## Job search

`src/lib/job-search.ts` queries LinkedIn's public guest job-search
endpoint natively in the Worker — no API key, no Python sidecar. The
former multi-board Python sidecar (`api/python/`, wrapping
python-jobspy) was removed because Cloudflare Workers has no Python
runtime. See [ADR-0005](decisions/0005-linkedin-only-job-search.md).
Resume-aware semantic ranking uses the shared fleet Knowledgebase RAG
service (`RAG_SERVICE_KEY` + `ROLEPATCH_RAG_INDEX_ID`).

## Apply-agent

Review-first queue model: save jobs → build packets → reviewed browser
checks → guarded single submit attempts → capture receipts → learn
reusable profile answers. Never unattended bulk apply, never captcha
bypass, never unattended file upload. See
[ADR-0003](decisions/0003-apply-agent-review-first.md) and the
[apply-agent CLI runbook](../operations/runbooks/apply-agent-cli.md).

## Landing overlay

`pnpm cf:build` builds the Next.js app, then builds the Astro landing
(`landing-astro/`), then overlays the Astro `index.html` onto the
OpenNext assets so `/` serves the static Astro HTML. The Worker still
owns every downstream funnel route. See
[ADR-0004](decisions/0004-astro-landing-overlay.md) and the
[landing-astro runbook](../operations/runbooks/landing-astro.md).

## Key files

| File | Purpose |
| --- | --- |
| `worker.mjs` | Custom Worker entry: edge cache, cron dispatch, DO re-exports. |
| `agent-edge.mjs` | Agent indexing surfaces (`llms.txt`, `/api/ai`). |
| `timing.mjs` | `withTiming` observability wrapper. |
| `open-next.config.ts` | OpenNext incremental cache override. |
| `wrangler.toml` | Worker config, D1 binding, Browser Rendering binding, crons, routes. |
| `src/lib/db.ts` | Cloudflare D1 client. |
| `src/lib/db-schema.sql` | D1 schema (see [data model](data-model.md)). |
| `src/lib/local-storage.ts` | Guest data layer (mirrors DB interface). |
| `src/lib/auth.ts` | better-auth config (Google OAuth). |
| `src/lib/auth-utils.ts` | `getCurrentUserId()` helper. |
| `src/lib/ai.ts`, `src/lib/ai-cloudflare.ts` | AI provider adapter. |
| `src/lib/actions/` | All server actions (mutations + AI calls). |
| `src/lib/job-search.ts` | Native in-Worker LinkedIn job search. |
| `src/lib/pdf.ts` | PDF export via Browser Rendering. |
| `src/lib/apply-agent*.ts` | Apply-agent queue/packet/receipt/browser logic. |
| `src/lib/internal-route-auth.ts` | Internal cron route auth (`x-rolepatch-internal`). |
