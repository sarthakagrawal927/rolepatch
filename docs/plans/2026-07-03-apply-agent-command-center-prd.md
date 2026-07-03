# Apply Agent Command Center PRD

Date: 2026-07-03

## Summary

RolePatch should grow from "tailor this application" into a transparent apply
agent. The user should be able to find fitting roles, prepare truthful materials,
queue applications, review exactly what will be sent, and later inspect a receipt
of what happened.

This is inspired by Tsenta's public positioning around watched career pages,
one-tap or automated applications, tailored resumes and cover letters, receipts,
application tracking, sponsorship-aware answers, and agent/CLI channels. RolePatch
should not copy unsupported claims such as 50,000 watched pages or broad ATS
coverage until the product can prove them.

## Problem

RolePatch already handles the hard content work: scraping a job URL, tailoring a
resume, writing a cover letter, scoring fit, preparing interviews, and tracking
the campaign. The gap is the high-volume execution layer. Users still have to
manually decide which jobs are ready, open each ATS, fill repetitive fields, and
remember what answers were submitted.

## Goals

- Turn discovered jobs and saved-search matches into an explicit application
  queue.
- Show readiness per role: resume, cover letter, profile data, work authorization,
  open-ended answers, and user review.
- Keep automation transparent: require pause/review controls and keep receipts
  for every attempted submission.
- Start with RolePatch's current strengths before broad crawling: pasted job URLs,
  LinkedIn discovery, saved-search alerts, ATS links, and the existing campaign
  CRM.
- Preserve truthful applications. The agent must only use resume, stash, evidence,
  and user-provided profile facts.

## Non-Goals

- No unattended submissions in the first slice.
- No public claim of broad ATS coverage until tested provider adapters exist.
- No scraping arms race or bypass behavior.
- No new paid dependency before a narrow prototype proves the workflow value.
- No storage of credentials, OAuth tokens, or secrets outside the user's explicit
  auth path.

## MVP Scope

### 1. Command Center

Add a dashboard surface that groups current jobs by readiness:

- Needs resume or tailoring
- Ready for user review
- Applied or in-flight
- Needs follow-up or receipt review

This slice is read-only and uses existing application status data.

### 2. Application Queue

Persist queue entries attached to `job_applications`:

- `queued`
- `needs_user`
- `ready_to_submit`
- `submitted`
- `failed`
- `skipped`

The queue should expose bulk actions, but the first submission path should still
require a per-job review.

### 3. Receipts

For each submit attempt, store:

- ATS/provider family
- Resume and cover letter version ids
- Fields filled and answer text
- Files uploaded
- Confirmation URL/text when available
- Failure reason and screenshot/log pointer when available

Receipts make the automation auditable and are the difference between a trusted
agent and a black box.

### 4. Profile Answers

Add a profile-answer bank for repeated ATS fields:

- Work authorization and sponsorship
- Location and relocation
- Salary expectations
- Demographic questions with explicit opt-in handling
- Short open-ended answers in the user's voice

The agent can suggest defaults, but sensitive fields require user confirmation.

### 5. Browser Submission Prototype

Prototype one or two high-confidence ATS providers only after receipts and review
gates exist. Good first candidates are providers already common in pasted URLs,
such as Greenhouse or Lever, because they are structured and simpler than Workday.

## Tsenta Parity Matrix

Source checked: `https://tsenta.com/` on 2026-07-03.

| Capability | Tsenta public claim | RolePatch state | Next RolePatch step |
| --- | --- | --- | --- |
| Career-page watching | Watches 50,000+ career pages across 15+ ATSes | Shipped company watchlists with daily Worker cron plus Greenhouse, Lever, Ashby, Workable, Recruitee, Personio, and generic career URL adapters; no scale claim | Add deeper ATS adapters only after measured reliability |
| Match feed | Top matches with percentage scores | Shipped dashboard match feed plus saved-search/company-watch alert import into the apply-agent queue | Tune ranking after enough discovery alert usage |
| Tailored resume | Per-role ATS-safe resume, review before send | Shipped tailoring + diff + ATS score | Keep as base for apply-agent queue |
| Cover letter | Per-role cover letter | Shipped cover-letter route | Surface cover-letter readiness directly in queue |
| Apply queue | All/in-flight/needs-you/failed/skipped queue | Shipped queue statuses, filters, readiness chips, dashboard controls, bulk queue status updates, retry recovery, machine-readable browser failure codes, and provider-aware remediation playbooks | Add deeper provider-specific automation after real receipt data |
| Auto-submit | Opens ATS form and submits | Reviewed extension submit shipped after explicit user confirmation; unattended/headless submit is not shipped | Add provider-specific headless runners only after reviewed submit receipts prove reliable |
| Receipt | Exact fields, answers, documents, ATS confirmation | Manual receipts, extension `filled`/`failed` receipts, user-selected file upload receipts, reviewed submit receipts, confirmation capture, and automation health metrics shipped | Keep unattended uploads blocked until reviewed mode is reliable |
| Profile answers | Work auth, sponsorship, open-ended answers | Shipped profile-answer bank | Use answers in browser adapter receipts |
| Reply routing | Recruiter emails route application status | Shipped Cloudflare Email Routing ingest with conservative status updates, thread grouping, editable suggested drafts, and fail-closed outbound send controls | Configure production routing/sending and add mailbox sync later |
| Messaging | iMessage/WhatsApp confirmation flows | Not shipped | Add email first; messaging only after core workflow is stable |
| Chrome extension | Detects job pages and fills fields | Assisted fill shipped with Greenhouse/Lever/Workday/Ashby/Workable/Recruitee/Personio field context, radio/checkbox handling, cover-letter textareas, fill receipts, reviewed submit, and submitted/failed receipts | Add provider-specific reliability evidence before unattended modes |
| MCP/CLI | Agent tools can apply on behalf of user | Stable HTTP contracts, local `pnpm apply-agent -- ...` CLI, and `pnpm apply-agent:mcp` MCP server shipped for review-first workflows with guarded submit and failure-code triage | Keep raw submit tools guarded by default |
| Pricing by applications | Volume tiers + free starts | Token/Dodo payment foundation exists | Revisit entitlements only after real submissions exist |

## Similar Product Research

Background research checked public pages for Tsenta, Simplify, Teal, FastApply,
JobCopilot, LoopCV, LazyApply, AIApply, Massive, Sonara, Resume Tailor, and
Kickresume on 2026-07-03.

Product lessons for RolePatch:

- **Copy Tsenta and JobCopilot on trust:** receipts, exact field answers,
  reviewed submit modes, official-source language, and daily/weekly recaps.
- **Copy Simplify before copying full auto-submit:** Chrome-assisted capture and
  autofill are lower-risk than claiming unattended applications.
- **Copy Teal's tracker depth:** notes, statuses, goals, and saved-job workflow
  make the tool useful even before automation is perfect.
- **Copy FastApply's mode separation:** review mode, assisted mode, and later
  autopilot mode should be explicit settings.
- **Avoid LazyApply-style positioning:** annual lock-ins, low-trust extension
  signals, and raw daily-volume copy weaken the brand.
- **Avoid Sonara-style black-box promises:** "apply until hired" framing creates
  trust and quality risk.
- **Keep RolePatch's wedge:** truthful tailoring, visible diffs, fit scoring,
  review-first application packets, and receipts before any browser submit.

## Product Guardrails

- Every generated or selected answer must be traceable to a user-provided fact.
- The user can pause before submit and edit any field.
- Failed submissions remain useful by producing a retryable receipt.
- Unsupported ATS links fall back to manual open + prepared material, not silent
  failure.
- Work authorization answers must come from explicit profile settings.

## Data Model Sketch

```sql
application_queue (
  id text primary key,
  job_id text not null references job_applications(id),
  user_id text,
  status text not null,
  readiness_json text not null,
  created_at integer not null,
  updated_at integer not null
);

application_receipts (
  id text primary key,
  job_id text not null references job_applications(id),
  queue_id text references application_queue(id),
  provider text,
  status text not null,
  fields_json text not null,
  resume_id text,
  cover_letter_id text,
  confirmation_text text,
  confirmation_url text,
  failure_reason text,
  created_at integer not null
);

profile_answers (
  id text primary key,
  user_id text,
  category text not null,
  label text not null,
  answer text not null,
  sensitive integer not null default 0,
  created_at integer not null,
  updated_at integer not null
);
```

Guest mode can mirror these records in localStorage for command-center readiness
and manual export, but browser submission should remain signed-in until the auth
and receipt path is proven.

## Phases

1. Ship command-center visibility on the dashboard. **Shipped 2026-07-03.**
2. Add persisted queue and manual review states. **Shipped 2026-07-03.**
3. Add manual receipt records. **Shipped 2026-07-03.**
4. Add profile answers for repeated ATS fields. **Shipped 2026-07-03.**
5. Ship Chrome-assisted fill from saved profile answers. **Shipped 2026-07-03.**
6. Prototype one provider with a visible browser run and pause-before-submit.
7. Add bulk queue actions after per-job receipts and failure handling are stable. **Shipped 2026-07-04.**
8. Add CLI and MCP wrappers after the core server action contracts are stable. **Shipped 2026-07-04.**

## Acceptance Criteria

- Users can see which applications are ready, blocked, and already submitted.
- The UI labels browser submission and receipts as planned until those paths exist.
- Product docs and `PROJECT_STATUS.md` distinguish current visibility from future
  automation.
- The first backend follow-up has a queue schema, receipt schema, and tests.

## Shipped Slice

2026-07-03:

- Added `application_queue` and `application_receipts` tables.
- Added server actions for listing queue/receipts, queueing a job, refreshing
  readiness, updating queue status, and recording a manual submission receipt.
- Added guest localStorage mirrors for queue and receipts.
- Expanded the dashboard command center with queue controls, readiness refresh,
  queue status changes, and manual receipt capture.
- Added component coverage for readiness counts, planned automation labels, and
  queued receipt rendering.
- Added `profile_answers` storage, server actions, guest localStorage mirrors,
  dashboard profile-answer form, and readiness integration for work authorization,
  sponsorship, links, location, salary, and open-ended answers.
- Mounted the command center on `/dashboard` with signed-in server actions and
  guest localStorage handlers for queueing, readiness refresh, status updates,
  profile answers, packet views, and manual receipts.
- Added ROI-top-three parity slice: dashboard match feed, queue filters/readiness
  chips, and expandable prepared application packet with material links and
  profile-answer copy blocks.
- Added Cloudflare-first packet assembly through server actions over Turso plus
  guest localStorage parity. Packets now include ATS URL/provider, base resume,
  latest tailored resume excerpt, latest cover-letter excerpt, profile answers,
  and latest receipt.
- Manual receipts now capture the exact saved profile-answer fields in addition
  to submission mode and readiness.
- Added Chrome-assisted fill: `/api/extension/apply-packet` returns the tracked
  job's prepared packet for the current ATS URL, and the extension fills matched
  empty form fields from saved profile answers after explicit user action.
- Added recruiter reply routing: dashboard exposes a per-user forwarding address,
  Worker `email()` ingests inbound recruiter replies, the internal route logs
  events, creates alerts, and updates interview/offer/rejection status only when
  a tracked application match is confident.
- Added extension fill receipts: after explicit assisted fill, the extension
  posts filled field labels/answers to `/api/extension/fill-receipt`, creating a
  `filled` receipt and leaving the queue at `ready_to_submit`.
- Added provider-aware fill adapters for Greenhouse, Lever, Workday, Ashby,
  Workable, Recruitee, and Personio form containers, plus radio/checkbox answer
  handling, cover-letter textarea fill, and submit-button detection in receipts.
- Added user-triggered submission confirmation capture: after manual submit, the
  extension captures the confirmation page URL/text as a `submitted` receipt and
  marks the queue/application submitted.
- Added file-upload checklist capture: fill receipts now record visible upload
  fields as manual checklist items without uploading files.
- Added user-selected file upload assistance: during reviewed extension fill,
  the popup can pass explicitly selected resume/CV and cover-letter files to
  matching ATS file inputs, and receipts separate uploaded files from remaining
  manual upload fields.
- Added apply-agent HTTP API contracts under `/api/apply-agent/*` for queue,
  packet, receipt, and status operations.
- Added local apply-agent CLI wrapper over those HTTP contracts.
- Added local apply-agent MCP stdio server over those HTTP contracts for
  review-first queue, packet, receipt, and status tools.
- Added bulk queue status updates in the dashboard, HTTP API, CLI, and MCP
  server for review-first queue management without bulk submission.
- Restored the Chrome extension end-to-end apply-agent flow: packet fetch,
  explicit field fill, fill receipt recording, and user-triggered submitted
  receipt capture.
- Added failed-fill receipts so extension errors leave retryable audit records
  and move the queue to `failed`.
- Added queue retry recovery in the dashboard, HTTP API, CLI, and MCP server;
  retry preserves existing receipts and recomputes current readiness.
- Added extension job capture: the popup can save the current ATS page into
  RolePatch, reuse existing tracked jobs, and queue the job for review.
- Added canonical ATS URL matching for extension save/tailor/packet/fill routes
  so query strings and hashes do not break tracked-job lookup.
- Added final field snapshots to reviewed submit and manual submitted-receipt
  capture so receipts preserve the actual visible ATS answers at submission
  time.
- Added conservative answer learning from successful submitted receipts into
  the profile-answer bank, with learned values marked sensitive and upload/file
  fields ignored.
- Added batch reviewed browser checks across dashboard, HTTP API, CLI, and MCP
  so selected or recent queue entries can be inspected sequentially without
  submitting.
- Expanded reviewed browser-check provider support to Greenhouse, Lever,
  Workday, Ashby, Workable, Recruitee, and Personio so server checks match the
  extension's assisted-fill ATS coverage.
- Added a guarded Browser Rendering submit pilot for one ready queue entry at a
  time. It can fill from profile answers/materials and click submit only when no
  CAPTCHA, file upload, missing required field, unsupported provider, or missing
  Browser binding blocker remains; every attempt records a receipt.
- Added capped batch guarded submit across dashboard, HTTP API, CLI, and MCP for
  selected or recent `ready_to_submit` entries with per-entry results/errors.
- Added machine-readable browser failure codes in reviewed check and guarded
  submit results, persisted those codes in receipt fields, and surfaced generic
  next-step remediation in the dashboard queue.
- Added automation health metrics in the command center: browser receipt count,
  guarded-submit success ratio, provider outcomes, and top failure-code blockers.
- Added saved-search and company-watch alert metadata so discovery alerts with
  job URLs can be imported into tracked draft applications and queued from the
  apply-agent command center.
- Added provider-aware remediation playbooks for Greenhouse, Lever, Workday,
  Ashby, Workable, Recruitee, and Personio, used by failed queue receipts and
  automation-health blockers.
- Added signed-in reviewed browser check: queue entries can open an ATS page
  through Cloudflare Browser Rendering, detect form/submit/upload/captcha
  signals, record an audit receipt, and update queue readiness without
  submitting.
- Added recruiter reply threading and deterministic draft suggestions: routed
  replies now store thread keys, suggested reply subject/body, and dashboard
  copy controls.
- Added outbound recruiter reply send: dashboard threads expose editable reply
  subject/body fields and send through the existing Resend adapter. Sends fail
  closed when email is unconfigured and persist sent/error metadata on the
  routed event.
- Wired the custom Cloudflare Worker entrypoint with `scheduled()` handlers for
  company-watch and weekly-digest internal routes, an Email Routing `email()`
  handler for recruiter reply ingest, and a 404 guard for external
  `/api/internal/*` requests. Production cron trigger and Email Routing rule
  provisioning remain explicit deployment setup steps.
- Added career-page watch adapters: company watches use Greenhouse, Lever,
  Ashby, Workable, Recruitee, and Personio public feeds/APIs when a matching
  career URL is present, fall back to generic HTML parsing for custom pages, and
  then fall back to LinkedIn search if no career-page roles are found.
- Added company-watch run observability: each watch persists and displays the
  last source, found count, and adapter error/fallback metadata so supported
  career-page coverage can be measured before any scale claim.
- Added reviewed extension submit: after explicit user confirmation, the
  extension blocks CAPTCHA/human-verification pages, unfilled required fields,
  pending file uploads, and missing submit buttons before clicking the ATS
  submit button. It records `submitted` receipts only when confirmation
  text/URL is detected, otherwise it records `failed` receipts without marking
  the application applied.

Still not shipped:

- Unattended browser submit automation.
- Unattended file upload automation.
- Bulk unattended submission.
- Production Email Routing/Resend configuration.
- Mailbox sync.
- Broad watched-page scale claims and deeper ATS adapters.

## Cloudflare-First Execution Boundary

The apply-agent path should stay on the deployed RolePatch stack:

- **OpenNext Worker/server actions** for queue, packet, receipt, profile-answer,
  and status mutations.
- **Turso/libSQL** for durable signed-in state.
- **localStorage** for guest parity.
- **Workers cron** for company watchlists and scheduled discovery. The Worker
  dispatcher expects `0 13 * * *` for company watches and `0 14 * * 1` for
  weekly digest once production triggers are provisioned.
- **Cloudflare Email Routing** for recruiter reply ingestion through the custom
  Worker `email()` handler.
- **Cloudflare Browser Rendering** for reviewed provider-specific form filling
  where a browser is required.

Avoid local Python, long-running desktop Playwright workers, or sidecar crawlers
unless a future provider adapter proves that Cloudflare cannot run the needed
path safely.
