# resume-tailor — PROJECT STATUS

Last updated: 2026-06-20

## Why / What

RolePatch is an AI resume and job-application assistant. It helps users tailor resumes, generate cover letters, research companies, score role fit, prepare STAR stories, and run guest or signed-in application workflows with a campaign CRM, achievement evidence bank, and job-discovery alerts.

**Users:** Job seekers in guest mode (localStorage) or signed-in via Google OAuth; operators on `rolepatch.com` Cloudflare Workers deploy.

**Constraints:** LinkedIn-only job search (no Python JobSpy sidecar on Workers); rate limits on scrape deferred; Astro landing overlay for fleet perf on `/`.

**IN scope:** Resume editor, tailoring, cover letters, interview prep, tools hub, campaign CRM, evidence bank, saved-search alerts (in-dashboard), Dodo token checkout, PDF export via Browser Rendering.

**OUT of scope:** Git history purge (Option A), broad ATS/recruiter CRM, multi-board crawlers, email alerts for saved searches, aggressive scraping without endpoint evidence.

Live on `rolepatch.com` via Cloudflare Workers (OpenNext).

## Dependencies

### External

- **Turso (libSQL):** Signed-in persistence: jobs, applications, evidence, saved searches, alerts.
- **Dodo Payments:** Token purchases; webhook + success verification hardened in audit.
- **LinkedIn (guest API):** In-Worker job search — no API key; datacenter IP rate limits possible.
- **Cloudflare Browser Rendering:** PDF resume export (replaces broken puppeteer-core path).
- **PostHog:** Product analytics.
- **Env files:** `.env.example` — `TURSO_*`, `AI_*`, `BETTER_AUTH_*`, `GOOGLE_*`, optional `DODO_*`.

### Internal (fleet)

| Service | Role |
| --- | --- |
| **free-ai** | All AI traffic via Workers AI chokepoint (`https://free-ai-gateway.sarthakagrawal927.workers.dev/v1`) |
| **SaaS Maker feedback** | Optional `NEXT_PUBLIC_SAASMAKER_API_KEY` |
| **Local astro landing scripts** | Astro static hero overlaid during `cf:build` via `scripts/run-overlay-astro-landing.mjs` (fleet perf / psi-swarm TTFB-LCP on `/`) |

### Stack & commands

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · CodeMirror · Vitest · Playwright · Cloudflare Workers via `@opennextjs/cloudflare` · Turso · better-auth Google OAuth · Drizzle migrations · Vercel AI SDK · free-ai-gateway · Cloudflare Browser Rendering · Dodo Payments · PostHog · `@saas-maker/feedback` · local astro overlay scripts.

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install deps |
| `cp .env.example .env.local` | Local env |
| `pnpm dev` | next dev → http://localhost:3000 |
| `pnpm build` | next build --webpack |
| `pnpm cf:build` | next + astro-landing inline + opennext + overlay |
| `pnpm deploy` | cf:build + wrangler deploy |
| `pnpm start` | next start (Node preview only) |
| `pnpm typecheck` / `pnpm test` / `pnpm test:e2e` | TS + vitest + playwright |
| `pnpm lint` / `pnpm check` | lint + biome check |

CI: GitHub Actions auto-deploy to Cloudflare on push to `main`.

**Entrypoints:** `worker.mjs` · server actions `src/lib/actions/*` · API routes `/api/jobs` · job search `src/lib/job-search.ts` · PDF `src/lib/pdf.ts` · guest layer `src/lib/local-storage.ts`.

## Timeline

- **2026-06-12 — Application campaign CRM shipped:** Dashboard pipeline tracker with status funnel; inline status changes; follow-up/interview/offer metadata; `ApplicationCampaignTracker` + `JobDetailsModal`; `buildCampaignSummary()` metrics; overdue follow-up alerts; guest parity via localStorage; Turso migrations for campaign fields.
- **2026-06-12 — Achievement evidence intelligence shipped:** Structured evidence bank at `/evidence`; quality scoring (strong/usable/weak); job-aware ranking injected into tailor prompts; Turso table `achievement_evidence`; guest localStorage key `rt-achievement-evidence`; unit tests in `achievement-evidence.test.ts`.
- **2026-06-12 — Job discovery alerts shipped:** Saved job searches with pause/delete/re-run; shortlist with duplicate URL detection; in-dashboard alerts; Turso + guest parity; UI in `job-discovery.tsx`. Email notifications explicitly deferred.
- **Privacy PRD (Option B):** `get-a-job/` and `research/` paths untracked from repo; repository set private. Git history purge (Option A) explicitly parked.
- **Security audit:** Critical/high closed — guest data isolation, SSRF on scrape, payment webhook atomicity, success verification, AI model allowlist.

## Products

| Surface | URL |
| --- | --- |
| Primary app | `https://rolepatch.com` |
| WWW redirect route | `https://www.rolepatch.com/*` |
| Auth callback base | `BETTER_AUTH_URL=https://rolepatch.com` |
| AI gateway | `https://free-ai-gateway.sarthakagrawal927.workers.dev/v1` |

## Features (shipped)

### Architecture

- Browser (Next.js 16 App Router, React 19) → OpenNext → `worker.mjs` + ASSETS (`.open-next/assets`); Smart Placement → Turso region.
- Cloudflare Worker `resume-tailor`: server actions, `/api/jobs` routes, Browser Rendering binding (`BROWSER`) for PDF export.
- Turso libSQL + better-auth Google OAuth for signed-in users; guest flows use localStorage with signed-in sync.
- AI via `AI_BASE_URL` → free-ai-gateway; Dodo Payments for token checkout.
- Landing: Astro static hero via local `scripts/run-overlay-astro-landing.mjs` overlaid during `cf:build` for fleet perf (psi-swarm TTFB/LCP improvement on `/`).
- Job search runs natively in Worker — `src/lib/job-search.ts` queries LinkedIn public guest endpoint; `src/app/api/jobs/search/route.ts` exposes it to UI.

### Core product surfaces

- **Landing & marketing**: `/` Astro overlay hero; `/pricing`, `/blog`, `/badge/[slug]`, legal pages.
- **Resume editor**: `/editor/[id]` CodeMirror markdown editing with autosave.
- **Tailoring**: `/tailor/[jobId]` AI rewrite to match JD; fit scoring.
- **Cover letters**: `/cover-letter/[jobId]` with company research.
- **Interview prep**: `/interview-prep/[jobId]` STAR story generation.
- **Stash & settings**: `/stash`, `/settings`.
- **Tools hub**: `/tools/*` — ATS check, keywords, word count, bullet check, diff, snippets.
- **Dashboard**: `/dashboard` — campaign CRM + job discovery hub.

### Auth & guest mode

- Guest mode via localStorage for full core flows; Google sign-in persists to Turso.
- Guest data isolation fixes from security audit.
- Live production on `rolepatch.com`.

### AI & document handling

- AI via free-ai/OpenAI-compatible gateway with model allowlist (audit fix).
- Job URL scrape with SSRF validation.
- PDF export via Browser Rendering binding.
- Mammoth/marked/pdf-parse for document ingest paths.

### Payments

- Dodo checkout flow; webhook handled in transaction; success page verification (audit fixes).

### Job search (LinkedIn-only)

- Native Worker implementation in `src/lib/job-search.ts`.
- Public guest endpoint — former Python JobSpy sidecar removed (no Python on Workers).
- Scope intentionally LinkedIn-only; no multi-board crawler.

### Application campaign CRM (2026-06-12)

- Dashboard pipeline tracker with status funnel: draft → tailored → applied → interview → offer → rejected.
- Inline status changes; follow-up/interview/offer metadata on applications.
- `ApplicationCampaignTracker` + `JobDetailsModal` for notes and reminders.
- `buildCampaignSummary()` metrics: weekly target progress, follow-ups due, stale drafts, response rate, next actions.
- Overdue follow-up alerts in dashboard.
- **Guest parity**: CRM fields stored in localStorage for unsigned users.
- Tables/migrations for application campaign fields in Turso.

### Achievement evidence intelligence (2026-06-12)

- Structured evidence bank at `/evidence` (`AchievementEvidenceBank` component).
- Quality scoring: **strong / usable / weak** via `scoreEvidenceQuality()` (metrics, outcomes, scope).
- Job-aware ranking via `rankEvidenceForRole()` / `rankEvidenceForJob()` injected into tailor prompts (`tailor-action.ts`).
- Reusable formatted bullets for resume and interview prep surfaces.
- Turso table `achievement_evidence`; guest localStorage key `rt-achievement-evidence`.
- Unit tests in `achievement-evidence.test.ts`.

### Job discovery alerts (2026-06-12)

- Saved job searches with pause, delete, and manual re-run.
- Shortlist with duplicate URL detection.
- In-dashboard alerts for new saved-search matches.
- Persistence: `saved_job_searches`, `saved_job_shortlist`, `job_discovery_alerts` (Turso + guest parity).
- UI: `job-discovery.tsx` component on dashboard.
- **Not shipped**: email notifications for alerts (explicitly deferred).

## Todo / Planned / Deferred / Blocked

### Planned

1. Improve scrape and job-search reliability without broadening unsupported providers.
2. Add targeted integration tests for highest-risk guest, auth, payment, and AI failure paths.
3. Tighten user-facing AI error handling so provider failures are clear without exposing internals.
4. Measure saved-search alert engagement before adding email or broader job-board coverage.

### Deferred

- **Git history purge (Option A)**: parked — user chose untrack-only (Option B).
- Broad ATS replacement or recruiter CRM scope.
- Aggressive scraping and strict rate limits pending endpoint-specific evidence.
- Additional payment/provider expansion until checkout and entitlement paths repeatedly verified.
- Job discovery email notifications and multi-board crawlers.
- LinkedIn-only job search; datacenter IP rate limits may require Browser Rendering or hosted API fallback.
- Residual audit: no rate limiting on scrape endpoint (deferred); no CORS config (same-origin default).
- Email alerts for saved searches not implemented; engagement not yet measured.
- Integration test coverage thin on guest/auth/payment/AI failure paths.

### Blocked

- (none)
