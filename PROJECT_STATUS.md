# resume-tailor — PROJECT STATUS

Last updated: 2026-07-05

## Why / What

RolePatch is an AI resume and job-application assistant. It helps users tailor resumes, generate cover letters, research companies, score role fit, prepare STAR stories, and run guest or signed-in application workflows with a campaign CRM, achievement evidence bank, job-discovery alerts, recruiter reply routing, and a review-first apply-agent command center.

**Users:** Job seekers in guest mode (localStorage) or signed-in via Google OAuth; operators on `rolepatch.com` Cloudflare Workers deploy.

**Constraints:** General job search is LinkedIn-only (no Python JobSpy sidecar on Workers); company watches can use supported career URLs; job URL scraping has a lightweight app-level limiter; Astro landing overlay for fleet perf on `/`.

**IN scope:** Resume editor, tailoring, cover letters, interview prep, tools hub, campaign CRM, evidence bank, saved-search/company-watch alerts, recruiter reply routing, Dodo token checkout, PDF export via Browser Rendering, and review-first apply-agent queue/packet/receipt workflows.

**OUT of scope:** Git history purge (Option A), broad ATS/recruiter CRM, multi-board crawlers, unattended bulk apply, unattended file upload automation, captcha bypass, production Email Routing rule setup, and aggressive scraping without endpoint evidence.

Live on `rolepatch.com` via Cloudflare Workers (OpenNext).

## Dependencies

### External

- **Cloudflare D1:** Signed-in persistence: jobs, applications, evidence, saved searches, alerts.
- **Dodo Payments:** Token purchases; webhook + success verification hardened in audit.
- **LinkedIn (guest API):** In-Worker job search — no API key; datacenter IP rate limits possible.
- **Cloudflare Browser Rendering:** PDF resume export (replaces broken puppeteer-core path).
- **Cloudflare Email Routing:** Inbound recruiter replies to per-user forwarding addresses; Worker `email()` handler routes to internal ingestion.
- **Resend:** Optional weekly digest sending path; fails closed when `RESEND_API_KEY` is unset.
- **PostHog:** Product analytics.
- **Env files:** `.env.example` — `AI_*`, `BETTER_AUTH_*`, `GOOGLE_*`, optional `DODO_*`, `RESEND_*`, and RAG settings.

### Internal (fleet)

| Service | Role |
| --- | --- |
| **free-ai** | All AI traffic via Workers AI chokepoint (`https://free-ai-gateway.sarthakagrawal927.workers.dev/v1`) |
| **knowledge-base** | Optional semantic job/resume similarity via the shared RAG service (`RAG_SERVICE_KEY` + `ROLEPATCH_RAG_INDEX_ID`) |
| **SaaS Maker feedback** | Optional `NEXT_PUBLIC_SAASMAKER_API_KEY` |
| **Local astro landing scripts** | Astro static hero overlaid during `cf:build` via `scripts/run-overlay-astro-landing.mjs` (fleet perf / psi-swarm TTFB-LCP on `/`) |

### Stack & commands

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · CodeMirror · Vitest · Playwright · Cloudflare Workers via `@opennextjs/cloudflare` · Cloudflare D1 · better-auth Google OAuth · Wrangler D1 migrations · Vercel AI SDK · free-ai-gateway · Cloudflare Browser Rendering · Dodo Payments · PostHog · `@saas-maker/feedback` · local astro overlay scripts.

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
| `pnpm verify:deploy-routes` | Verifies built Next app manifest contains parity-critical routes before deploy |
| `pnpm smoke:prod` / `pnpm smoke:local` | Public production/local smoke plus optional authenticated apply-agent read checks |

CI: GitHub Actions auto-deploy to Cloudflare on push to `main`.

**Entrypoints:** `worker.mjs` · server actions `src/lib/actions/*` · API routes `/api/jobs` · job search `src/lib/job-search.ts` · PDF `src/lib/pdf.ts` · guest layer `src/lib/local-storage.ts`.

## Timeline

- **2026-07-04 — Guest live job discovery shipped:** Dashboard discovery no longer dead-ends guests; unsigned users can run the native Cloudflare-safe LinkedIn search, save local shortlists/searches, and create local tailoring drafts from discovered jobs while recurring company watches stay signed-in-only.
- **2026-07-04 — Standalone jobs browser shipped:** `/jobs` now exposes the live job browser outside the dashboard, hydrates guest local resumes for queue/tailor actions, and is linked from app navigation plus the Astro landing page.
- **2026-07-04 — Job browser quick searches shipped:** Discovery now includes one-click searches for remote AI, product engineering, new-grad software, and visa-sponsorship roles using the existing Cloudflare-safe search path.
- **2026-07-04 — Job card signals shipped:** Discovered job cards now show scan-friendly posting signals for remote, visa, new-grad, senior, lead, and contract hints inferred from available job text.
- **2026-07-04 — Job signal filters shipped:** Discovery results can now be filtered by inferred posting signals before batch queueing, so visible-match queueing respects the selected review subset.
- **2026-07-04 — Resume-aware discovery ranking shipped:** Search results can now be reordered by Knowledgebase semantic similarity against the selected resume before filtering or queueing.
- **2026-07-04 — Discovery semantic match scores shipped:** Resume-aware ranking now returns normalized Knowledgebase scores and surfaces semantic match percentages on ranked job cards.
- **2026-07-04 — Semantic match filters shipped:** Ranked discovery results can now be filtered to 90%+, 80%+, or 70%+ resume matches before visible-match batch queueing.
- **2026-07-04 — Discovery match evidence shipped:** Ranked job cards now show lightweight overlapping resume/job terms so users can inspect why a semantic match ranked highly before queueing.
- **2026-07-04 — Strong-match queue shipped:** Resume-ranked discovery can now queue all unqueued 80%+ semantic matches for reviewed apply prep in one action.
- **2026-07-04 — Semantic queue context shipped:** Jobs queued from resume-ranked discovery now preserve semantic score/evidence in job notes and surface it in the apply-agent queue review row.
- **2026-07-04 — Semantic queue badges shipped:** Apply-agent queue rows parse RolePatch semantic notes into a resume-match badge and evidence line instead of burying them as plain text.
- **2026-07-04 — Discovery alert queue context shipped:** Jobs queued from saved-search/company-watch alerts preserve source/location context and display it as a discovery badge in the apply-agent queue.
- **2026-07-04 — Multi-source queue context shipped:** Apply-agent queue rows can display semantic match and discovery alert context together for jobs touched by both discovery flows.
- **2026-07-04 — Batch alert-to-queue import shipped:** The command center can queue all visible saved-search/company-watch alerts with job URLs in one reviewed action while skipping already queued URLs.
- **2026-07-04 — Weekly apply-agent recap shipped:** Weekly digest emails now include apply-agent queue and receipt activity, so users see ready, blocked, filled, submitted, and recent ATS progress alongside new matches.
- **2026-07-04 — Discovery-to-apply queue shipped:** Search result cards can now create or reuse tracked jobs and add them directly to the reviewed apply-agent queue, with guest localStorage parity and signed-in queue refresh.
- **2026-07-04 — Batch discovery queue shipped:** Dashboard search results can now queue all visible unqueued matches for reviewed apply-agent preparation without submitting applications, deduping duplicate tracking URLs and showing a queued count.
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
- **2026-07-04 — Provider reliability evidence shipped:** Automation health now shows per-provider success/block rates and conservative expand/fix/collect recommendations from real receipts.
- **2026-07-04 — Similar-product research recorded:** Durable apply-agent competitor research now captures Tsenta, Simplify, Teal, Huntr, Massive, AIApply, Kickresume, and related lessons with an ROI order for future automation work.
- **2026-07-04 — Production smoke harness shipped:** `pnpm smoke:prod` now checks public production pages and optional authenticated apply-agent read APIs without mutating user data or storing secrets.
- **2026-07-04 — Production smoke drift recorded:** Public smoke against `https://rolepatch.com` passed landing/pricing but found `/jobs` returning 404 and `/settings` missing current readiness/extension content, so production needs a fresh deploy before the new parity surfaces are live.
- **2026-07-04 — Production smoke drift still open:** Latest public smoke against `https://rolepatch.com` passed landing/pricing only; `/jobs`, `/proof`, the TrueHire preview guard, and current settings readiness still require a fresh deploy before the local apply-agent/proof slice is live. Rechecked after the standalone release preflight on 2026-07-04 23:32 IST and smoke remained 2/6. Symphony task `4847b8bf` tracks the deploy follow-up.
- **2026-07-04 — Apply-agent/proof slice deployed:** Commit `5f5151c` deployed to Cloudflare Worker `resume-tailor` through GitHub Actions run `28715037108`; companion CI run `28715037109` passed. Post-deploy `pnpm smoke:prod` passed 6/6 against `https://rolepatch.com` at 2026-07-04 23:38 IST for landing, jobs, pricing, proof, TrueHire preview guard, and settings readiness. Authenticated read-only smoke was skipped because no `ROLEPATCH_SESSION_COOKIE` was provided.
- **2026-07-04 — Deploy build route evidence recorded:** `pnpm build` succeeds locally and the Next route manifest includes dynamic `/jobs`, `/proof`, and `/settings`, confirming the smoke failures are stale production deploy drift rather than missing current-repo routes.
- **2026-07-04 — Deploy route verifier shipped:** `pnpm verify:deploy-routes` now checks the built Next app manifest for parity-critical pages and APIs before deploy.
- **2026-07-04 — Cloudflare build route gate shipped:** `pnpm cf:build` now runs the deploy route verifier immediately after `next build --webpack`, before OpenNext and `wrangler deploy` can proceed.
- **2026-07-04 — Release preflight command shipped:** `pnpm release:verify` now runs the non-deploy release gates in one command: typecheck, lint, Vitest, extension build, Cloudflare build, standalone local public smoke, and focused desktop/mobile Playwright.
- **2026-07-04 — Release preflight passed:** `pnpm release:verify` passed end to end against the standalone artifact with copied `.next/static`/`public` assets on 2026-07-04 23:32 IST: typecheck, Biome, 405 Vitest tests, extension build, Cloudflare build, 13/13 deploy-route verification, 6/6 local public smoke, and 22 focused desktop/mobile Playwright tests.
- **2026-07-04 — Deploy handoff documented:** `docs/deploy-handoff.md` now captures the approved publish checklist, post-deploy smoke commands, task ids, and completion evidence needed once deploy approval is granted.
- **2026-07-04 — GitHub deploy workflow repaired:** `.github/workflows/deploy.yml` now actually listens for `main` pushes, pull requests, and manual dispatch, so the Cloudflare deploy job no longer has an unreachable `push` condition.
- **2026-07-04 — Deploy handoff path repaired:** SaaS Maker's fleet registry now maps `resume-tailor` to `/Users/sarthak/Desktop/fleet/rolepatch`, and the Symphony dispatcher resolves configured project paths before falling back to slug-derived directories.
- **2026-07-04 — Local production smoke verified:** Built app served with `next start -p 3005` passed the then-current public smoke 4/4 for landing, jobs browser, pricing, and settings readiness, using only a throwaway local auth secret. The current public smoke harness now checks 6 public routes, including `/proof` and the TrueHire preview guard.
- **2026-07-04 — Missing answer prompt loop shipped:** Failed guarded browser receipts with missing required fields now surface answer-gap prompts in the command center and can prefill the Profile answers form for the next retry.
- **2026-07-04 — Answer bank review shipped:** The apply-agent command center now summarizes profile-answer coverage, flags review-required learned answers, and shows missing work-auth/sponsorship/location/link coverage before guarded submit.
- **2026-07-04 — Receipt transparency summary shipped:** Apply-agent receipts now show answered, skipped, uploaded, manual-upload, blocker, and confirmation metrics in the command center so users can audit what automation actually did.
- **2026-07-04 — Field-level receipt details shipped:** Queue receipts can now expand to show captured field labels, values, and sources for exact application auditability.
- **2026-07-04 — Copyable receipt audit shipped:** Queue receipts can now copy a portable audit summary with job context, provider/status, confirmation evidence, and captured fields.
- **2026-07-04 — Receipt timeline shipped:** Queue entries with repeated fill/check/submit attempts now show a newest-first receipt timeline so retry history is visible during review.
- **2026-07-04 — Guarded submit copy hardened:** Dashboard controls now say `Guarded submit` instead of `Auto submit` so the reviewed-submit boundary stays clear.
- **2026-07-04 — Guarded submit API boundary shipped:** Browser-submit API success responses include machine-readable guardrail metadata declaring `unattended: false` and the refusal conditions.
- **2026-07-04 — Queue safety review shipped:** Apply-agent queue rows now block guarded submit for saved excluded companies, duplicate normalized ATS URLs, and low fit scores, surfacing the exact safety reason before review.
- **2026-07-04 — Required answer safety shipped:** Queue rows now block guarded submit until work-authorization and sponsorship profile answers exist.
- **2026-07-04 — Required answer prompt buttons shipped:** Missing work-authorization/sponsorship queue blockers can now prefill the profile-answer form directly from the safety review row.
- **2026-07-04 — Queue safety summary shipped:** The command center now summarizes blocked, warning, and clean queue entries before row-level review.
- **2026-07-04 — Company-history safety review shipped:** Queue rows now warn when another submitted-stage role already exists at the same company, without blocking legitimate multi-role applications.
- **2026-07-04 — Discovery alerts to apply-agent shipped:** Saved-search and company-watch alerts now preserve job URL metadata and can be imported directly into the apply-agent queue from the command center.
- **2026-07-04 — Provider remediation playbooks shipped:** Browser failure codes now resolve to provider-aware next steps for Greenhouse, Lever, Workday, Ashby, Workable, Recruitee, and Personio in queue receipts and automation health.
- **2026-07-04 — Cloudflare Worker runtime hooks wired:** `worker.mjs` now exposes scheduled cron handlers for company watches/weekly digest, an Email Routing `email()` handler for recruiter reply ingest, and a 404 guard for external `/api/internal/*` requests.
- **2026-07-04 — Operational readiness panel shipped:** `/settings` now shows safe Cloudflare-first runtime status for Browser Rendering, Resend, sender identity, AI gateway, auth/OAuth, and Worker hooks without exposing secret values.
- **2026-07-04 — Operational readiness e2e shipped:** Playwright now covers `/settings` readiness rendering on desktop and mobile Chromium with configured placeholder runtime env, verifying Cloudflare/email/auth/AI readiness labels render and secret values stay hidden.
- **2026-07-04 — Payment readiness visibility shipped:** `/settings` now reports Dodo checkout and webhook configuration readiness without exposing API keys, webhook secrets, or product IDs; desktop/mobile readiness e2e covers the payment items.
- **2026-07-04 — Apply-agent pricing boundary shipped:** `/pricing` now states that reviewed queue, packets, extension fill, and receipts are included while tokens fund AI work, with no subscription or unattended bulk-apply claim.
- **2026-07-04 — Receipt-first landing positioning shipped:** The Astro landing page now leads with reviewed apply, Chrome-assisted fill, packet/receipt transparency, and explicit no-unattended-bulk-apply boundaries instead of only resume-tailoring copy.
- **2026-07-04 — Discovery source decision shipped:** Dashboard discovery now summarizes active searches/watchlists, unseen alerts, latest company-watch yield, fallback/source health, and a setup/collecting/fix-current-sources/keep-current-sources recommendation before broader job-board or ATS-scale claims.
- **2026-07-04 — Queue materials checklist shipped:** Apply-agent queue entries now show explicit base resume, tailored resume, cover letter, profile answers, and receipt readiness instead of opaque readiness keys.
- **2026-07-04 — Safe AI failure copy shipped:** Resume import, tailoring, cover letters, fit score, interview prep, outreach, skills roadmap, and bulk rating now normalize provider failures into retryable/settings-focused user errors while preserving token/auth errors.
- **2026-07-04 — Safe job-search failure copy shipped:** Native LinkedIn job search now maps upstream rate limits, timeouts, and outages to actionable retry/company-watch/paste-URL guidance instead of exposing provider internals.
- **2026-07-04 — Add Job scrape fallback shipped:** The Add Job modal now switches to a manual job-description paste path when scraping cannot read a posting, preserving the tailor workflow instead of dead-ending on scrape failure.
- **2026-07-04 — Scrape rate limiter shipped:** Job URL scraping now has an app-level fixed-window limiter with typed rate-limit fallback copy that keeps users on the manual JD paste path.
- **2026-07-04 — Payment route coverage added:** Dodo checkout and webhook tests now cover auth rejection, invalid packs, checkout payloads, signature rejection, idempotent token grants, and refund transaction rollback.
- **2026-07-04 — Safe checkout failure copy shipped:** Dodo checkout now fails closed for missing config and maps provider outages to retryable user copy; pricing UI coverage verifies raw provider details are not shown.
- **2026-07-04 — Webhook fail-closed handling shipped:** Dodo webhooks now return explicit not-configured and invalid-payload responses before touching payment/token storage, while preserving signature verification and transactional grant/refund behavior.
- **2026-07-04 — Payment edge-case hardening shipped:** Checkout now rejects malformed/non-string pack payloads before calling Dodo, and refund webhooks write a negative token ledger row in the same transaction as the balance deduction and payment status update.
- **2026-07-04 — Browser-runner API input hardening shipped:** Reviewed browser-check and guarded-submit routes now reject non-object payloads and invalid batch limits before invoking Browser Rendering work.
- **2026-07-04 — Apply-agent API input hardening shipped:** Queue create/status/retry and manual receipt routes now reject malformed bodies and invalid queue statuses before queue mutations.
- **2026-07-04 — Extension API input hardening shipped:** Extension save-job, tailor, packet, fill-receipt, and submission-receipt routes now reject malformed bodies and sanitize receipt fields before database work.
- **2026-07-04 — Extension CORS hardening shipped:** Extension API routes now share a single CORS helper that grants credentialed browser access only to `chrome-extension://` origins instead of combining wildcard origins with credentials.
- **2026-07-04 — Extension manifest provider coverage aligned:** The MV3 manifest host permissions now cover the shipped assisted-fill providers (Greenhouse, Lever, Workday, Ashby, Workable, Recruitee, Personio, SmartRecruiters) without broad all-site permissions, and tests lock the package boundary.
- **2026-07-04 — Extension setup surfaced in settings:** `/settings` now shows the Chrome extension package command, unpacked load path, production API base, supported ATS providers, and permission boundary so extension-first onboarding is visible without claiming Chrome Web Store distribution.
- **2026-07-04 — Internal Worker route guard shipped:** Cron and Email Routing internal routes now require the Worker-only internal header before database, email, or watch-runner work, so route handlers fail closed even outside the custom Worker fetch guard.
- **2026-07-04 — Discovery/settings body hardening shipped:** AI model discovery, job search, and recruiter reply ingest now reject invalid/non-object JSON before provider calls or database work.
- **2026-07-04 — Knowledgebase semantic fit shipped:** Signed-in fit scoring can ingest jobs into the shared Knowledgebase RAG service, show a zero-weight Semantic Similarity evidence dimension on individual fit-score cards, and use semantic resume-to-job similarity to order bulk scoring before AI scoring; if the service is unconfigured or unavailable, scoring falls back to the existing AI-only path.
- **2026-07-04 — Knowledgebase similarity contract verified:** The RolePatch client now targets the actual `knowledge-base` Worker legacy index API (`/v1/indexes/:id/ingest` + `/query`), caps semantic queries to the service top-k ceiling, widens single-job lookup to tolerate repeated ingests, and surfaces whether settings will use the `RAG_SERVICE` binding or HTTPS fallback.
- **2026-07-04 — Guest apply-agent coverage added:** localStorage tests now cover guest queue readiness, manual receipt recording, applied status updates, and retry blocking after submission.
- **2026-07-04 — Apply-agent auth boundary coverage added:** API route tests now prove signed-out queue, packet, and receipt reads/mutations return 401 before DB access.
- **2026-07-04 — Guest Add Job fallback e2e shipped:** Playwright now covers guest scrape failure → manual JD paste → saved local job → tailor page on desktop and mobile Chromium, with configurable e2e base URL/server command for isolated smoke runs.
- **2026-07-04 — Guest receipt e2e shipped:** Playwright now covers a ready guest apply-agent queue entry being marked submitted, producing a Lever receipt, updating local job/queue state, and surfacing the receipt in the command center on desktop and mobile Chromium.
- **2026-07-04 — Bulk queue management shipped:** Dashboard, HTTP API, CLI, and MCP can bulk-update queue statuses for reviewed workflow management without submitting applications.
- **2026-07-04 — Apply-agent retry recovery shipped:** Dashboard, HTTP API, CLI, and MCP can retry non-submitted queue entries by recomputing readiness while preserving failed/skipped receipt history.
- **2026-07-04 — Company watch run observability shipped:** Watch runs now persist and display source, found-count, and fallback/error metadata for career-page adapters and LinkedIn fallback.
- **2026-07-04 — Career-page watch adapters shipped:** Company watches now use career URLs first with Greenhouse, Lever, Ashby, Workable, Recruitee, Personio, and generic page parsing before falling back to LinkedIn search.
- **2026-07-04 — SmartRecruiters watch adapter shipped:** Company watches now use the public SmartRecruiters company postings API before falling back to generic page parsing or LinkedIn.
- **2026-07-04 — SmartRecruiters apply coverage shipped:** Extension host permissions, scrape/provider detection, settings coverage, and reviewed Browser Rendering checks now include SmartRecruiters without adding all-site access.
- **2026-07-04 — Campaign contact hints shipped:** Campaign next actions now extract recruiter/contact hints from job notes and show them on follow-up/interview actions.
- **2026-07-04 — Campaign action timing shipped:** Campaign next actions now show due-today, overdue, upcoming-interview, and inactive-duration timing labels.
- **2026-07-04 — Campaign contact search shipped:** Campaign next actions now include recruiter and hiring-manager search links for user-controlled contact discovery.
- **2026-07-04 — Apply mode gates shipped:** The command center now derives Review, Assisted Fill, Guarded Submit, and Unattended Apply gate states from queue safety, saved answers, and browser receipt evidence, keeping unattended apply visibly locked even when provider evidence is promising.
- **2026-07-04 — Safety preferences shipped:** The command center now exposes excluded-company preferences as a first-class safety control backed by profile answers, with edit/update support and guest localStorage parity.
- **2026-07-04 — Fit-threshold safety shipped:** The command center now exposes a configurable minimum fit score backed by profile answers, and guarded submit blockers use that saved threshold instead of a hidden fixed cutoff.
- **2026-07-04 — Daily guarded-submit cap shipped:** Safety preferences now expose a daily guarded-submit cap backed by profile answers; single submits stop when the cap is reached and batch guarded submit trims to the remaining daily allowance.
- **2026-07-04 — Server guarded-submit cap shipped:** The shared guarded-submit runner now enforces the daily cap for dashboard, HTTP API, CLI, and MCP entrypoints, and the submit API advertises the cap in guardrail metadata.
- **2026-07-04 — Server queue-safety guard shipped:** The shared guarded-submit runner now enforces required answers, excluded companies, duplicate ATS URLs, and minimum fit score before provider or browser work, so API/CLI/MCP cannot bypass dashboard safety review.
- **2026-07-04 — Proof project surface shipped:** `/proof` now frames TrueHire as a separate proof/credibility project under RolePatch, preserving the proof-first landing direction while connecting artifacts to evidence, packets, receipts, and recruiter replies.
- **2026-07-04 — TrueHire-style proof landing shipped:** `/proof` now uses the stronger TrueHire landing thesis: tailored resumes are cheap, source-backed work is harder to fake, and proof remains user-controlled until attached.
- **2026-07-04 — Proof UI polish shipped:** `/proof` now uses a product-grade proof-profile hero, cleaner app typography, and responsive first-viewport proof visuals; dashboard/jobs operational headings now use the app sans typography.
- **2026-07-04 — Product UI e2e verified:** Focused Playwright desktop/mobile coverage passed for dashboard job-search tips, Add Job, manual JD fallback, tailor page, manual receipts, and settings readiness after the UI polish pass.
- **2026-07-04 — Proof readiness shipped:** Achievement evidence now derives proof-packet readiness without new schema, flags missing claim/support fields, and keeps external verification explicitly unshipped while the TrueHire proof lane matures.
- **2026-07-04 — Proof packet preview shipped:** `/proof` now previews shareable and needs-cleanup proof items from existing achievement evidence with signed-in persistence and guest localStorage parity, keeping all artifacts private/user-provided until attached later.
- **2026-07-04 — Proof items in apply packets shipped:** Prepared application packets now include optional user-provided proof items from achievement evidence across dashboard, HTTP API, extension packet API, and guest localStorage packets.
- **2026-07-04 — Job-matched proof packets shipped:** Application packet proof items are now selected per job from role/JD overlap, so the TrueHire-style proof bridge favors relevant evidence instead of a generic global proof list.
- **2026-07-04 — TrueHire contract audit shipped:** The TrueHire repo, landing position, public profile/export routes, schema contracts, verification artifacts, and privacy boundaries are inventoried in the RolePatch proof pipeline.
- **2026-07-04 — TrueHire read-only proof preview shipped:** `/proof` can preview public TrueHire profile exports as RolePatch proof candidates through a no-persistence API/UI bridge, preserving the separate-project boundary.
- **2026-07-04 — TrueHire opt-in evidence import shipped:** `/proof` can import previewed TrueHire public-work and confirmed-work proof into RolePatch achievement evidence with guest localStorage and signed-in Cloudflare D1 paths, deduped by source and still private until reviewed.
- **2026-07-04 — TrueHire pipeline task recorded:** Symphony task `2d15f69c` now tracks the next non-destructive TrueHire proof-project milestone decision under the `resume-tailor` project.
- **2026-07-04 — Proof-aware receipts shipped:** Manual submission receipts now snapshot job-matched proof candidates available at review time across signed-in and guest flows, making proof context auditable without claiming automatic employer sharing.
- **2026-07-04 — Copyable proof packets shipped:** Apply-agent packets now expose a manual copy/export control for job-matched proof points with explicit no-auto-share boundary text, giving users an opt-in proof sharing path.
- **2026-07-04 — Proof source links shipped:** Packet proof items now preserve source URLs from imported evidence and include them in manual proof exports plus receipt snapshots.
- **2026-07-04 — Copyable proof profile shipped:** `/proof` can now copy a standalone proof-profile summary from shareable evidence, including source URLs and explicit no-auto-share boundary text.
- **2026-07-04 — Proof-aware recruiter drafts shipped:** Routed recruiter replies that explicitly ask for portfolio, proof, GitHub, examples, or references now add matched proof candidates to the editable suggested reply draft.
- **2026-07-04 — Proof deploy gates shipped:** The deploy route verifier and production smoke harness now include `/proof`, preventing the separate proof surface from drifting out of Cloudflare builds.
- **2026-07-04 — Final local verification passed:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, extension typecheck/build, `pnpm build`, `pnpm cf:build`, deploy-route verification, local public smoke, and focused desktop/mobile Playwright coverage passed for the current apply-agent/proof/UI slice.
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
- **2026-06-12 — Application campaign CRM shipped:** Dashboard pipeline tracker with status funnel; inline status changes; follow-up/interview/offer metadata; `ApplicationCampaignTracker` + `JobDetailsModal`; `buildCampaignSummary()` metrics; overdue follow-up alerts; guest parity via localStorage; SQL migrations for campaign fields.
- **2026-06-12 — Achievement evidence intelligence shipped:** Structured evidence bank at `/evidence`; quality scoring (strong/usable/weak); job-aware ranking injected into tailor prompts; Cloudflare D1 table `achievement_evidence`; guest localStorage key `rt-achievement-evidence`; unit tests in `achievement-evidence.test.ts`.
- **2026-06-12 — Job discovery alerts shipped:** Saved job searches with pause/delete/re-run; shortlist with duplicate URL detection; in-dashboard alerts; Cloudflare D1 + guest parity; UI in `job-discovery.tsx`. Email notifications explicitly deferred.
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

- Browser (Next.js 16 App Router, React 19) → OpenNext → `worker.mjs` + ASSETS (`.open-next/assets`); signed-in persistence uses the D1 `DB` binding.
- Cloudflare Worker `resume-tailor`: server actions, `/api/jobs` routes, Browser Rendering binding (`BROWSER`) for PDF export.
- Cloudflare D1 + better-auth Google OAuth for signed-in users; guest flows use localStorage with signed-in sync.
- AI via `AI_BASE_URL` → free-ai-gateway; Dodo Payments for token checkout.
- Landing: Astro static hero via local `scripts/run-overlay-astro-landing.mjs` overlaid during `cf:build` for fleet perf (psi-swarm TTFB/LCP improvement on `/`).
- Job search runs natively in Worker — `src/lib/job-search.ts` queries LinkedIn public guest endpoint; `src/app/api/jobs/search/route.ts` exposes it to UI.

### Core product surfaces

- **Landing & marketing**: `/` Astro overlay hero; `/pricing`, `/blog`, `/badge/[slug]`, legal pages.
- **Resume editor**: `/editor/[id]` CodeMirror markdown editing with autosave.
- **Tailoring**: `/tailor/[jobId]` AI rewrite to match JD; fit scoring.
- **Cover letters**: `/cover-letter/[jobId]` with company research.
- **Interview prep**: `/interview-prep/[jobId]` STAR story generation.
- **Stash & settings**: `/stash`, `/settings`; settings includes safe operational readiness checks for Cloudflare/browser automation, email, payments, auth, and AI setup.
- **Tools hub**: `/tools/*` — ATS check, keywords, word count, bullet check, diff, snippets.
- **Dashboard**: `/dashboard` — campaign CRM + job discovery hub.
- **Proof project**: `/proof` — TrueHire-inspired credibility surface for evidence, packets, receipts, and recruiter replies.

### Auth & guest mode

- Guest mode via localStorage for full core flows; Google sign-in persists to Cloudflare D1.
- Guest data isolation fixes from security audit.
- Live production on `rolepatch.com`.

### AI & document handling

- AI via free-ai/OpenAI-compatible gateway with model allowlist (audit fix).
- AI provider, timeout, rate-limit, auth, and malformed-output failures are normalized into user-facing retry/settings messages across generation actions.
- AI model discovery validates request bodies before contacting configured OpenAI-compatible endpoints.
- Job URL scrape with SSRF validation, retry/fallback fetching, lightweight app-level rate limiting, and manual JD paste fallback from Add Job when a posting is unreadable or temporarily rate-limited.
- PDF export via Browser Rendering binding.
- Mammoth/marked/pdf-parse for document ingest paths.

### Payments

- Dodo checkout flow; webhook handled in transaction; success page verification (audit fixes).

### Job search (LinkedIn-only)

- Native Worker implementation in `src/lib/job-search.ts`.
- Public guest endpoint — former Python JobSpy sidecar removed (no Python on Workers).
- Guests can run live job search from dashboard discovery and save found roles into local tailoring drafts without signing in.
- `/jobs` is a standalone browse surface for search, shortlist, tailoring drafts, and reviewed apply-agent queueing.
- Quick-search presets help users start common searches without learning query syntax; they reuse the same LinkedIn-only Worker search endpoint.
- Job cards show lightweight, heuristic posting signals such as remote, visa, new-grad, senior, lead, and contract to support faster review before queueing.
- Signal filters narrow visible results and batch queueing to selected posting hints.
- Signed-in users can rank discovered jobs by Knowledgebase semantic similarity against the selected resume before queueing.
- Ranked cards show normalized semantic match percentages from Knowledgebase so users can see why the order changed.
- Semantic match thresholds narrow visible results and batch queueing to stronger resume matches after ranking.
- Ranked cards include lightweight overlapping resume/job terms as explainable match evidence.
- The semantic match panel can queue all unqueued 80%+ matches for reviewed apply prep without submitting applications.
- Apply-agent queue rows preserve and display semantic discovery context when jobs are queued from resume-ranked discovery.
- Apply-agent queue rows render semantic discovery context as a score badge plus evidence terms for faster review.
- Jobs queued from discovery alerts preserve source/location context and render it as a queue badge for review.
- Queue notes merge semantic and alert context without dropping either source when the same tracked job is touched by multiple discovery flows.
- Apply-agent discovery alerts can be imported to the reviewed queue in a single batch action; duplicate/already queued URLs are skipped before queueing.
- Weekly digest emails include apply-agent progress recaps from queue and receipt activity, not only fresh saved-search matches.
- Search result cards can queue found jobs for reviewed apply-agent preparation without first opening the tailor flow.
- Discovery includes a visible-results batch queue action for reviewed packet prep; duplicate tracking URLs are deduped, queued matches are marked locally to prevent repeat clicks, and users get a queued-count confirmation.
- API search failures return user-safe guidance for rate limits, timeouts, and temporary upstream outages.
- Job-search requests validate object-shaped request bodies before LinkedIn guest-endpoint calls.
- Scope intentionally LinkedIn-only; no multi-board crawler.

### Application campaign CRM (2026-06-12)

- Dashboard pipeline tracker with status funnel: draft → tailored → applied → interview → offer → rejected.
- Inline status changes; follow-up/interview/offer metadata on applications.
- `ApplicationCampaignTracker` + `JobDetailsModal` for notes and reminders.
- `buildCampaignSummary()` metrics: weekly target progress, follow-ups due, stale drafts, response rate, next actions.
- Next actions extract recruiter/contact hints from notes, including email, LinkedIn URL, or labeled recruiter/contact/interviewer fields.
- Next actions show timing context for due follow-ups, overdue follow-ups, upcoming interviews, and inactive draft/tailored roles.
- Next actions include user-controlled recruiter and hiring-manager search links scoped to the company/role.
- Overdue follow-up alerts in dashboard.
- **Guest parity**: CRM fields stored in localStorage for unsigned users.
- Tables/migrations for application campaign fields in Cloudflare D1.

### Achievement evidence intelligence (2026-06-12)

- Structured evidence bank at `/evidence` (`AchievementEvidenceBank` component).
- Quality scoring: **strong / usable / weak** via `scoreEvidenceQuality()` (metrics, outcomes, scope).
- Job-aware ranking via `rankEvidenceForRole()` / `rankEvidenceForJob()` injected into tailor prompts (`tailor-action.ts`).
- Reusable formatted bullets for resume and interview prep surfaces.
- `/proof` frames TrueHire as a separate proof/credibility project under RolePatch, preserving the landing-page direction while tying verified artifacts to evidence, apply packets, receipts, and recruiter replies.
- Evidence cards derive proof-packet readiness from existing fields, showing proof-ready, packet-ready, needs-support, and needs-claim states without claiming external verification.
- `/proof` previews shareable proof packet items and needs-cleanup items from signed-in evidence or guest localStorage evidence without publishing them.
- Prepared application packets include optional proof items derived from proof-ready evidence, and the dashboard packet drawer links back to `/proof` for review before any employer sharing.
- Cloudflare D1 table `achievement_evidence`; guest localStorage key `rt-achievement-evidence`.
- Unit tests in `achievement-evidence.test.ts`.

### Job discovery alerts (2026-06-12, expanded 2026-07-03)

- Saved job searches with pause, delete, and manual re-run.
- Guest saved searches, shortlists, and discovered-job tailoring drafts persist locally; signed-in users get synced persistence.
- Company watchlists with pause, delete, manual check, and daily Worker cron.
- Career URL watches prefer Greenhouse, Lever, Ashby, Workable, Recruitee, Personio, and SmartRecruiters public feeds/APIs, then a generic HTML parser for custom career pages, and fall back to LinkedIn search when no career jobs are found.
- Each company watch records and displays the last run source (`greenhouse`, `lever`, `ashby`, `workable`, `recruitee`, `personio`, `smartrecruiters`, `career_page`, `linkedin`, or `linkedin_fallback`), found count, and adapter error when fallback is needed.
- Dashboard discovery summarizes active saved searches and company watches, unseen alert volume, latest watch yield, fallback/source health, and a source-decision recommendation so expansion decisions can use product evidence.
- Shortlist with duplicate URL detection.
- In-dashboard alerts for new saved-search and company-watch matches.
- Persistence: `saved_job_searches`, `company_watches`, `saved_job_shortlist`, `job_discovery_alerts` (Cloudflare D1 + guest parity). `company_watches` includes `last_source`, `last_found_count`, and `last_error`.
- UI: `job-discovery.tsx` component on dashboard.
- Weekly digest scaffolding exists through Workers cron and Resend; it fails closed when `RESEND_API_KEY` is unset.
- `worker.mjs` dispatches scheduled company-watch and weekly-digest runs to internal routes when production cron triggers are provisioned.
- `/settings` surfaces whether email sending and Dodo payment config are present, whether the Browser Rendering binding is visible at runtime, and which Cloudflare setup steps remain.
- **Not shipped**: broad/scaled career-page crawling claims, deep ATS-specific company adapters beyond Greenhouse/Lever/Ashby/Workable/Recruitee/Personio/generic parsing, production Email Routing/Resend setup.

### Apply agent foundation (2026-07-03/04)

- Persisted `application_queue`, `application_receipts`, and `profile_answers` tables.
- Shared TypeScript contracts for queue entries, readiness, receipts, profile answers, and prepared application packets.
- Dashboard command center includes match feed, queue filters, readiness refresh, packet drawer, profile-answer form, manual receipt capture, and bulk queue status updates.
- Prepared application packets can include optional user-provided proof items from the evidence bank for review alongside resume, cover letter, profile answers, and receipts.
- Dashboard discovery cards can add found jobs directly to the reviewed apply-agent queue while preserving duplicate URL reuse.
- Queue rows show an explicit materials checklist for base resume, tailored resume, cover letter, profile answers, and receipt readiness.
- Saved-search and company-watch alerts with job URLs surface in the command center and can create tracked draft applications plus queue entries.
- Dashboard automation health summarizes browser-runner receipts, guarded-submit success, provider outcomes, and top failure-code blockers.
- Provider evidence summarizes success/block rates and recommends whether to collect more receipts, fix blockers, or consider deeper provider automation.
- Apply mode gates summarize which workflow modes are live, ready, blocked, collecting evidence, or locked based on queue safety, saved profile answers, and browser receipts; unattended apply remains locked even when a provider has candidate evidence for deeper design.
- Safety preferences surface excluded-company controls directly in the command center; edits update the underlying profile answer in signed-in and guest modes, and matching queued companies remain blocked from guarded submit.
- Minimum fit score is a visible safety preference; queue rows block guarded submit below the saved threshold, defaulting to 70 when no threshold answer exists.
- Daily guarded-submit cap is a visible safety preference; the command center counts same-day guarded-submit receipts, blocks single submit at the cap, and limits batch guarded submit to the remaining allowance.
- The shared guarded-submit runner enforces the daily cap server-side across dashboard actions, HTTP API, CLI, and MCP. Batch selection is trimmed before browser work starts, and cap-reached calls fail before queue lookup.
- The shared guarded-submit runner also enforces queue safety server-side: required work-auth/sponsorship answers, excluded-company preferences, duplicate normalized ATS URLs, and minimum fit score all stop guarded submit before provider or browser work.
- Missing required field blockers from guarded browser receipts become profile-answer prompts that can prefill the answer form before retry.
- Queue and packet receipts summarize answered/skipped fields, uploaded files, outstanding manual uploads, blockers, and confirmation capture.
- Queue receipts can expand to show exact captured field labels, values, and sources, giving users a Tsenta-style audit trail for submitted or attempted applications.
- Queue receipts can copy a portable audit summary containing job context, provider/status, confirmation evidence, and captured fields.
- Repeated receipt attempts render as a newest-first queue timeline for reviewable retry history.
- Queue rows surface safety review blockers for excluded companies saved in profile answers, duplicate normalized ATS URLs, and fit scores below 70; guarded submit refuses those entries until reviewed.
- Queue rows also block guarded submit until work-authorization and sponsorship answer categories are present, so sensitive eligibility fields are not guessed.
- Required-answer safety blockers include action buttons that prefill the profile-answer form for the missing category.
- Command center queue safety summary shows blocked entries, warning count, and clean entries before row-level review.
- Queue rows also warn when another submitted-stage role already exists at the same company, so users can review company history before submitting another application.
- Guest parity for queue, packets, profile answers, manual receipts, and bulk queue status updates through localStorage.
- Extension packet API at `/api/extension/apply-packet` returns the current user's prepared packet for a tracked ATS URL.
- Extension API routes validate object-shaped request bodies and normalize receipt fields before creating jobs, returning packets, or writing application receipts.
- Extension API CORS reflects Chrome extension origins only; arbitrary web origins are not granted credentialed browser access.
- Chrome extension assisted fill can fill matched empty fields from saved profile answers/materials after explicit user action.
- Chrome extension assisted fill can attach user-selected resume/CV and cover-letter files to matching file inputs; receipts record uploaded files separately from remaining manual upload fields.
- Provider-aware scrape/fill context for Greenhouse, Lever, Workday, Ashby, Workable, Recruitee, Personio, SmartRecruiters, LinkedIn scrape, and generic fallback for other ATS pages.
- Fill receipts capture exact field labels/answers, detected provider, submit-button presence, and manual file-upload checklist items, then leave queued items ready for review/submission.
- Failed extension fills create `failed` receipts with failure reasons and mark the queue failed for retry/review.
- User-triggered confirmation capture records a `submitted` receipt after the user manually submits the ATS form.
- Reviewed extension submit can click the detected ATS submit button only after explicit user confirmation and preflight checks for CAPTCHA/human verification, unfilled required fields, outstanding file uploads, and submit-button presence.
- Reviewed submit records a `submitted` receipt only when confirmation text/URL is detected; ambiguous submit attempts create `failed` receipts and do not mark the job applied.
- HTTP API routes under `/api/apply-agent/*` expose queue, packet, receipt, single-status, and bulk-status contracts.
- Apply-agent HTTP mutations validate object-shaped request bodies, queue statuses, retry actions, and receipt inputs before invoking queue or receipt writes.
- Local CLI wrapper `pnpm apply-agent -- ...` and MCP stdio server `pnpm apply-agent:mcp` expose the same review-first contracts.
- Reviewed browser check uses Cloudflare Browser Rendering when available, falls back to HTML inspection locally, records an audit receipt, and updates the queue to `ready_to_submit`, `needs_user`, or `failed`.
- **Not shipped**: unattended submit, unattended file upload automation, captcha bypass, provider-specific headless submit runners, bulk unattended apply.

### Recruiter reply routing (2026-07-03)

- Dashboard exposes a per-user `reply+...@rolepatch.com` forwarding address.
- Cloudflare Worker `email()` ingests inbound recruiter replies and routes them to `/api/internal/email/recruiter-reply`.
- `worker.mjs` blocks ordinary external requests to `/api/internal/*`; scheduled/email handlers call those routes through OpenNext with an internal Worker header.
- Internal cron and recruiter-reply routes also require the Worker-only internal header at the route handler before doing database, email, or watch-runner work.
- Recruiter reply ingest validates object-shaped payloads before routing messages or writing events.
- `/settings` lists Worker hooks as code-ready and keeps production cron/Email Routing activation as an explicit operator step.
- Ingest logs routed events, creates dashboard alerts, and updates interview/offer/rejection status only on confident tracked-application matches.
- Routed replies store thread keys and deterministic suggested reply drafts; dashboard groups threads and exposes copyable replies.
- Dashboard reply threads can send editable suggested replies through the existing Resend adapter. Sends fail closed when `RESEND_API_KEY` is unset and persist sent/error metadata on the routed reply event.
- Suggested reply drafts include matched proof candidates only when the recruiter explicitly asks for proof, examples, GitHub, portfolio, references, or verification; the draft remains editable and is not sent automatically.
- **Not shipped**: mailbox sync and production Email Routing/Resend rule setup.

## Todo / Planned / Deferred / Blocked

### Planned

1. Add deeper provider-specific automation only after reviewed browser receipts have enough real failure-code evidence.
2. Add live credentialed evidence for payment/provider callbacks once production credentials and callback events are available.
3. Use saved-search/company-watch engagement and fallback health to decide whether broader job-board coverage is worth adding.
4. TrueHire proof-project next milestone: tracked in Symphony task `2d15f69c`. Evaluate keeping TrueHire as a separate proof/credibility project under RolePatch, preserve the landing-page and brand strengths, and choose one next non-destructive milestone before any deeper merge.

### Deferred

- **Git history purge (Option A)**: parked — user chose untrack-only (Option B).
- Broad ATS replacement or recruiter CRM scope.
- Aggressive scraping and stricter endpoint-specific rate limits pending live endpoint evidence.
- Additional payment/provider expansion until checkout and entitlement paths repeatedly verified.
- Production Email Routing/Resend setup and mailbox sync.
- Multi-board crawlers and deeper ATS-specific company watch adapters beyond the current career URL adapters.
- LinkedIn-only job search; datacenter IP rate limits may require Browser Rendering or hosted API fallback.
- Residual audit: no CORS config (same-origin default).
- Unattended browser auto-submit and bulk unattended apply remain deferred until reviewed submit plus confirmation receipts prove reliable.
- Live e2e coverage remains thin for credentialed payment/provider callback paths.

### Blocked

- (none)

### Production Drift

- Latest public `pnpm smoke:prod` run: 2/4 passed on `https://rolepatch.com`; `/jobs` returned 404 and `/settings` did not render the current operational-readiness/extension content. Authenticated apply-agent smoke was skipped because no `ROLEPATCH_SESSION_COOKIE` was supplied.
- Current repo deploy build evidence: `pnpm build` passed on 2026-07-04 and listed `/jobs`, `/proof`, and `/settings` as dynamic app routes.
- Current repo route-manifest gate: `pnpm verify:deploy-routes` passed 13/13 after the latest build, including `/proof` and `/api/proof/truehire-preview`; `pnpm cf:build` runs that gate automatically before OpenNext/Wrangler deploy work.
- Current repo local production smoke evidence: `ROLEPATCH_SMOKE_BASE_URL=http://localhost:3010 pnpm smoke:prod` passed 6/6 on 2026-07-04 against the active local server, including `/proof`, `/jobs`, `/settings`, and the TrueHire preview guard. Authenticated apply-agent read checks remain skipped unless `ROLEPATCH_SESSION_COOKIE` is supplied.
