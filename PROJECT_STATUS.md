# resume-tailor — PROJECT STATUS

Last updated: 2026-07-04

## Why / What

RolePatch is an AI resume and job-application assistant. It helps users tailor resumes, generate cover letters, research companies, score role fit, prepare STAR stories, and run guest or signed-in application workflows with a campaign CRM, achievement evidence bank, job-discovery alerts, recruiter reply routing, and a review-first apply-agent command center.

**Users:** Job seekers in guest mode (localStorage) or signed-in via Google OAuth; operators on `rolepatch.com` Cloudflare Workers deploy.

**Constraints:** General job search is LinkedIn-only (no Python JobSpy sidecar on Workers); company watches can use supported career URLs; rate limits on scrape deferred; Astro landing overlay for fleet perf on `/`.

**IN scope:** Resume editor, tailoring, cover letters, interview prep, tools hub, campaign CRM, evidence bank, saved-search/company-watch alerts, recruiter reply routing, Dodo token checkout, PDF export via Browser Rendering, and review-first apply-agent queue/packet/receipt workflows.

**OUT of scope:** Git history purge (Option A), broad ATS/recruiter CRM, multi-board crawlers, unattended bulk apply, unattended file upload automation, captcha bypass, production Email Routing rule setup, and aggressive scraping without endpoint evidence.

Live on `rolepatch.com` via Cloudflare Workers (OpenNext).

## Dependencies

### External

- **Turso (libSQL):** Signed-in persistence: jobs, applications, evidence, saved searches, alerts.
- **Dodo Payments:** Token purchases; webhook + success verification hardened in audit.
- **LinkedIn (guest API):** In-Worker job search — no API key; datacenter IP rate limits possible.
- **Cloudflare Browser Rendering:** PDF resume export (replaces broken puppeteer-core path).
- **Cloudflare Email Routing:** Inbound recruiter replies to per-user forwarding addresses; Worker `email()` handler routes to internal ingestion.
- **Resend:** Optional weekly digest sending path; fails closed when `RESEND_API_KEY` is unset.
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

- **2026-07-04 — Extension save-to-queue shipped:** Chrome extension can save the current ATS job into RolePatch, reuse existing tracked jobs, and queue it in the review-first apply-agent command center.
- **2026-07-04 — Canonical ATS URL matching shipped:** Extension save, tailor, packet, and fill receipt routes match exact and no-query/no-hash job URLs so ATS tracking params do not break workflows.
- **2026-07-04 — Submission field snapshots shipped:** Reviewed submit and manual submitted-receipt capture now store final visible ATS field labels/values in application receipts.
- **2026-07-04 — Submitted-answer learning shipped:** Successful submitted receipts now learn reusable sensitive profile answers from final ATS field snapshots while ignoring file/upload fields.
- **2026-07-04 — Batch reviewed browser checks shipped:** Dashboard, HTTP API, CLI, and MCP can run sequential reviewed browser checks over selected/recent queue entries without submitting applications.
- **2026-07-04 — Reviewed browser ATS coverage expanded:** Browser-check provider support now aligns with extension-assisted fill for Greenhouse, Lever, Workday, Ashby, Workable, Recruitee, and Personio.
- **2026-07-04 — Guarded browser submit pilot shipped:** Dashboard, HTTP API, CLI, and MCP can run a single Browser Rendering submit attempt that fills from saved answers/materials, refuses CAPTCHA/upload/required-field blockers, and records submitted/failed receipts.
- **2026-07-04 — Batch guarded browser submit shipped:** Dashboard, HTTP API, CLI, and MCP can run capped sequential guarded submits for selected/recent `ready_to_submit` queue entries with per-entry results/errors.
- **2026-07-04 — Browser failure-code triage shipped:** Reviewed checks and guarded submits now return machine-readable failure codes, persist them in receipt fields, and surface next-step remediation in the dashboard.
- **2026-07-04 — Automation health dashboard shipped:** The apply-agent command center now summarizes browser receipts, guarded-submit success ratio, provider-level outcomes, and top blockers before broader ATS claims.
- **2026-07-04 — Discovery alerts to apply-agent shipped:** Saved-search and company-watch alerts now preserve job URL metadata and can be imported directly into the apply-agent queue from the command center.
- **2026-07-04 — Provider remediation playbooks shipped:** Browser failure codes now resolve to provider-aware next steps for Greenhouse, Lever, Workday, Ashby, Workable, Recruitee, and Personio in queue receipts and automation health.
- **2026-07-04 — Cloudflare Worker runtime hooks wired:** `worker.mjs` now exposes scheduled cron handlers for company watches/weekly digest, an Email Routing `email()` handler for recruiter reply ingest, and a 404 guard for external `/api/internal/*` requests.
- **2026-07-04 — Bulk queue management shipped:** Dashboard, HTTP API, CLI, and MCP can bulk-update queue statuses for reviewed workflow management without submitting applications.
- **2026-07-04 — Apply-agent retry recovery shipped:** Dashboard, HTTP API, CLI, and MCP can retry non-submitted queue entries by recomputing readiness while preserving failed/skipped receipt history.
- **2026-07-04 — Company watch run observability shipped:** Watch runs now persist and display source, found-count, and fallback/error metadata for career-page adapters and LinkedIn fallback.
- **2026-07-04 — Career-page watch adapters shipped:** Company watches now use career URLs first with Greenhouse, Lever, Ashby, Workable, Recruitee, Personio, and generic page parsing before falling back to LinkedIn search.
- **2026-07-04 — Outbound recruiter reply send shipped:** Dashboard recruiter reply threads now have editable send controls backed by the fail-closed Resend adapter and durable sent/error metadata.
- **2026-07-04 — Reviewed extension submit shipped:** The Chrome extension can click the ATS submit button after explicit user confirmation, blocks CAPTCHA/upload/required-field risks, and records submitted or failed receipts.
- **2026-07-04 — User-selected file upload assist shipped:** Extension fill can attach popup-selected resume/CV and cover-letter files to matching ATS file inputs and record uploaded files in receipts.
- **2026-07-04 — Reviewed browser check shipped:** Signed-in queue entries can run a Cloudflare Browser Rendering backed form check that records an audit receipt and updates queue readiness without submitting.
- **2026-07-04 — Expanded extension ATS coverage shipped:** Extension scraping/fill context now covers Ashby, Workable, Recruitee, and Personio in addition to Greenhouse, Lever, Workday, LinkedIn, and generic pages.
- **2026-07-04 — Recruiter reply threading and drafts shipped:** Routed recruiter replies now store thread keys and suggested reply drafts, and the dashboard groups reply threads with copyable draft responses.
- **2026-07-04 — Extension failed-fill receipts shipped:** Failed assisted-fill attempts now create failed receipts with a retryable failure reason and mark the queue failed instead of disappearing.
- **2026-07-04 — Apply-agent MCP server shipped:** `pnpm apply-agent:mcp` exposes review-first queue, packet, status, and receipt tools over MCP stdio using the existing RolePatch session.
- **2026-07-04 — Apply-agent CLI shipped:** `pnpm apply-agent -- ...` wraps queue, packet, receipt, and status APIs for local agent/CLI workflows.
- **2026-07-04 — Apply-agent HTTP API shipped:** Session-authenticated queue, packet, receipt, and queue-status routes are available for local CLI/MCP adapters.
- **2026-07-04 — Provider-aware apply fill shipped:** Extension autofill uses provider-aware field context for Greenhouse, Lever, and Workday, handles radio/checkbox answers, fills cover-letter textareas, detects submit buttons, records file-upload checklist items, and captures user-triggered submitted confirmation receipts.
- **2026-07-03 — Recruiter reply routing shipped:** Dashboard exposes a per-user forwarding address; Cloudflare Email Routing ingest logs recruiter replies, creates alerts, and conservatively updates application status.
- **2026-07-03 — Company watchlists shipped:** Dashboard can save target-company watches, manually check them, and run active watches daily through Workers cron.
- **2026-07-03 — Apply-agent command center shipped:** Dashboard queue, readiness summary, packet drawer, profile-answer bank, manual receipts, extension packet API, and Chrome-assisted fill foundation shipped with guest parity.
- **2026-07-02** — Added global try/catch error handler to OpenNext worker (`worker.mjs`).
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

### Job discovery alerts (2026-06-12, expanded 2026-07-03)

- Saved job searches with pause, delete, and manual re-run.
- Company watchlists with pause, delete, manual check, and daily Worker cron.
- Career URL watches prefer Greenhouse, Lever, Ashby, Workable, Recruitee, and Personio public feeds/APIs, then a generic HTML parser for custom career pages, and fall back to LinkedIn search when no career jobs are found.
- Each company watch records and displays the last run source (`greenhouse`, `lever`, `ashby`, `workable`, `recruitee`, `personio`, `career_page`, `linkedin`, or `linkedin_fallback`), found count, and adapter error when fallback is needed.
- Shortlist with duplicate URL detection.
- In-dashboard alerts for new saved-search and company-watch matches.
- Persistence: `saved_job_searches`, `company_watches`, `saved_job_shortlist`, `job_discovery_alerts` (Turso + guest parity). `company_watches` includes `last_source`, `last_found_count`, and `last_error`.
- UI: `job-discovery.tsx` component on dashboard.
- Weekly digest scaffolding exists through Workers cron and Resend; it fails closed when `RESEND_API_KEY` is unset.
- `worker.mjs` dispatches scheduled company-watch and weekly-digest runs to internal routes when production cron triggers are provisioned.
- **Not shipped**: broad/scaled career-page crawling claims, deep ATS-specific company adapters beyond Greenhouse/Lever/Ashby/Workable/Recruitee/Personio/generic parsing, production Email Routing/Resend setup.

### Apply agent foundation (2026-07-03/04)

- Persisted `application_queue`, `application_receipts`, and `profile_answers` tables.
- Shared TypeScript contracts for queue entries, readiness, receipts, profile answers, and prepared application packets.
- Dashboard command center includes match feed, queue filters, readiness refresh, packet drawer, profile-answer form, manual receipt capture, and bulk queue status updates.
- Saved-search and company-watch alerts with job URLs surface in the command center and can create tracked draft applications plus queue entries.
- Dashboard automation health summarizes browser-runner receipts, guarded-submit success, provider outcomes, and top failure-code blockers.
- Guest parity for queue, packets, profile answers, manual receipts, and bulk queue status updates through localStorage.
- Extension packet API at `/api/extension/apply-packet` returns the current user's prepared packet for a tracked ATS URL.
- Chrome extension assisted fill can fill matched empty fields from saved profile answers/materials after explicit user action.
- Chrome extension assisted fill can attach user-selected resume/CV and cover-letter files to matching file inputs; receipts record uploaded files separately from remaining manual upload fields.
- Provider-aware scrape/fill context for Greenhouse, Lever, Workday, Ashby, Workable, Recruitee, Personio, LinkedIn scrape, and generic fallback for other ATS pages.
- Fill receipts capture exact field labels/answers, detected provider, submit-button presence, and manual file-upload checklist items, then leave queued items ready for review/submission.
- Failed extension fills create `failed` receipts with failure reasons and mark the queue failed for retry/review.
- User-triggered confirmation capture records a `submitted` receipt after the user manually submits the ATS form.
- Reviewed extension submit can click the detected ATS submit button only after explicit user confirmation and preflight checks for CAPTCHA/human verification, unfilled required fields, outstanding file uploads, and submit-button presence.
- Reviewed submit records a `submitted` receipt only when confirmation text/URL is detected; ambiguous submit attempts create `failed` receipts and do not mark the job applied.
- HTTP API routes under `/api/apply-agent/*` expose queue, packet, receipt, single-status, and bulk-status contracts.
- Local CLI wrapper `pnpm apply-agent -- ...` and MCP stdio server `pnpm apply-agent:mcp` expose the same review-first contracts.
- Reviewed browser check uses Cloudflare Browser Rendering when available, falls back to HTML inspection locally, records an audit receipt, and updates the queue to `ready_to_submit`, `needs_user`, or `failed`.
- **Not shipped**: unattended submit, unattended file upload automation, captcha bypass, provider-specific headless submit runners, bulk unattended apply.

### Recruiter reply routing (2026-07-03)

- Dashboard exposes a per-user `reply+...@rolepatch.com` forwarding address.
- Cloudflare Worker `email()` ingests inbound recruiter replies and routes them to `/api/internal/email/recruiter-reply`.
- `worker.mjs` blocks ordinary external requests to `/api/internal/*`; scheduled/email handlers call those routes through OpenNext with an internal Worker header.
- Ingest logs routed events, creates dashboard alerts, and updates interview/offer/rejection status only on confident tracked-application matches.
- Routed replies store thread keys and deterministic suggested reply drafts; dashboard groups threads and exposes copyable replies.
- Dashboard reply threads can send editable suggested replies through the existing Resend adapter. Sends fail closed when `RESEND_API_KEY` is unset and persist sent/error metadata on the routed reply event.
- **Not shipped**: mailbox sync and production Email Routing/Resend rule setup.

## Todo / Planned / Deferred / Blocked

### Planned

1. Improve scrape and job-search reliability without broadening unsupported providers.
2. Add deeper provider-specific automation only after reviewed browser receipts have enough real failure-code evidence.
3. Add targeted integration tests for highest-risk guest, auth, payment, and AI failure paths.
4. Tighten user-facing AI error handling so provider failures are clear without exposing internals.
5. Measure saved-search/company-watch engagement before adding broader job-board coverage.

### Deferred

- **Git history purge (Option A)**: parked — user chose untrack-only (Option B).
- Broad ATS replacement or recruiter CRM scope.
- Aggressive scraping and strict rate limits pending endpoint-specific evidence.
- Additional payment/provider expansion until checkout and entitlement paths repeatedly verified.
- Production Email Routing/Resend setup and mailbox sync.
- Multi-board crawlers and deeper ATS-specific company watch adapters beyond the current career URL adapters.
- LinkedIn-only job search; datacenter IP rate limits may require Browser Rendering or hosted API fallback.
- Residual audit: no rate limiting on scrape endpoint (deferred); no CORS config (same-origin default).
- Unattended browser auto-submit and bulk unattended apply remain deferred until reviewed submit plus confirmation receipts prove reliable.
- Integration test coverage thin on guest/auth/payment/AI failure paths.

### Blocked

- (none)
