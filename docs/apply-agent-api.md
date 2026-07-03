# Apply-Agent HTTP API

These routes expose the review-first apply-agent contracts for local CLIs,
future MCP tools, and browser automation adapters. They use the existing
RolePatch web session; no separate API key flow is shipped yet.

All responses are JSON.

## CLI

The repo ships a thin no-dependency wrapper over these HTTP routes:

```bash
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- queue:list
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- queue:add job_123
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- queue:status queue_123 ready_to_submit
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- queue:retry queue_123
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- queue:status:bulk skipped --queue-ids queue_123,queue_456
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- browser:check queue_123
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- browser:check:batch --queue-ids queue_123,queue_456
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- browser:submit queue_123
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- browser:submit:batch --queue-ids queue_123,queue_456
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- packets:list --job-id job_123
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- receipts:list --job-id job_123
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent -- receipts:record queue_123 --text "Submitted in ATS"
```

Set `ROLEPATCH_BASE_URL=https://rolepatch.com` to target production. The default
base URL is `http://localhost:3000`.

## MCP

The repo also ships a no-dependency MCP stdio server over the same HTTP routes:

```bash
ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent:mcp
```

Use `ROLEPATCH_BASE_URL=https://rolepatch.com` to target production. The server
speaks MCP over stdio with `Content-Length` framing and exposes these tools:

| Tool | Purpose |
| --- | --- |
| `rolepatch_queue_list` | List queue entries and readiness state |
| `rolepatch_queue_add` | Queue a tracked job by `job_id` |
| `rolepatch_queue_status` | Update queue status |
| `rolepatch_queue_retry` | Retry a non-submitted queue item after recomputing readiness |
| `rolepatch_queue_status_bulk` | Bulk update queue statuses without submitting |
| `rolepatch_browser_check` | Run reviewed browser check without submitting |
| `rolepatch_browser_check_batch` | Run reviewed browser checks for selected or recent queue entries without submitting |
| `rolepatch_browser_submit` | Run guarded Browser Rendering submit for one ready queue entry |
| `rolepatch_browser_submit_batch` | Run guarded Browser Rendering submit for selected or recent ready queue entries |
| `rolepatch_packets_list` | Read prepared application packets |
| `rolepatch_receipts_list` | Read application receipts |
| `rolepatch_receipts_record` | Record a reviewed manual submission receipt |

Example MCP client config:

```json
{
  "mcpServers": {
    "rolepatch-apply-agent": {
      "command": "pnpm",
      "args": ["apply-agent:mcp"],
      "cwd": "/Users/sarthak/Desktop/fleet/rolepatch",
      "env": {
        "ROLEPATCH_BASE_URL": "http://localhost:3000",
        "ROLEPATCH_SESSION_COOKIE": "better-auth.session_token=..."
      }
    }
  }
}
```

## Queue

`GET /api/apply-agent/queue`

Returns the authenticated user's application queue.

`POST /api/apply-agent/queue`

```json
{ "job_id": "job_123" }
```

Queues a tracked job and returns the queue entry with readiness checks.

`PATCH /api/apply-agent/queue/:id`

```json
{ "status": "ready_to_submit" }
```

Updates queue status. Valid statuses: `queued`, `needs_user`,
`ready_to_submit`, `submitted`, `failed`, `skipped`.

`POST /api/apply-agent/queue/:id`

```json
{ "action": "retry" }
```

Retries a non-submitted queue entry by recomputing readiness from the current
job, resume, cover-letter, profile-answer, and receipt state. Existing failed
or skipped receipts are preserved for audit history.

`PATCH /api/apply-agent/queue`

```json
{
  "queue_ids": ["queue_123", "queue_456"],
  "status": "skipped"
}
```

Bulk-updates queue statuses for reviewed queue management. This does not create
submission receipts or submit applications.

## Reviewed Browser Check

`POST /api/apply-agent/browser-check`

```json
{ "queue_id": "queue_123" }
```

Runs a signed-in reviewed browser check for a queued application. In production
it uses the Cloudflare Browser Rendering binding; locally it falls back to
lightweight HTML inspection. The check records an audit receipt, detects
form/field/submit/upload/captcha signals, and updates the queue to
`ready_to_submit`, `needs_user`, or `failed`. It does not click submit.
The reviewed provider allowlist covers Greenhouse, Lever, Workday, Ashby,
Workable, Recruitee, and Personio.

Results include a nullable machine-readable `failure_code` for retry routing
and UI filters. Current codes are `provider_unsupported`, `captcha_detected`,
`file_upload_required`, `missing_required_fields`, `submit_button_missing`,
`form_not_found`, `browser_unavailable`, `browser_navigation_failed`,
`confirmation_missing`, and `runtime_failure`. The same code is also recorded
as a receipt field named `Failure code`.

Batch mode uses the same route with selected queue ids, or a `limit` to process
recent eligible queue entries:

```json
{
  "queue_ids": ["queue_123", "queue_456"],
  "limit": 2
}
```

Batch checks run sequentially, are capped server-side, return per-entry
results/errors, and still do not submit applications.

## Guarded Browser Submit

`POST /api/apply-agent/browser-submit`

```json
{ "queue_id": "queue_123" }
```

Runs a single guarded submit attempt through Cloudflare Browser Rendering. This
is the first unattended-submit path and is intentionally narrow: it requires the
Browser Rendering binding, an allowlisted provider, visible fields that can be
filled from saved profile answers/materials, no CAPTCHA/human verification, no
file uploads, no missing required fields, and a detectable submit button. It
records a receipt for every attempt, updates the queue to `submitted`,
`needs_user`, or `failed`, and only marks the tracked application `applied` when
an ATS confirmation is detected.

Submit results include the same nullable `failure_code` field and persist it in
the receipt field snapshot for audit and retry triage.

Batch guarded submit uses the same route with `queue_ids` and/or `limit`:

```json
{
  "queue_ids": ["queue_123", "queue_456"],
  "limit": 2
}
```

Batch mode only processes `ready_to_submit` queue entries, runs sequentially, is
capped server-side, and returns per-entry results/errors.

## Packets

`GET /api/apply-agent/packets`

Returns prepared application packets. Filter with either repeated
`job_id=...` params or a comma-separated `job_ids=...`.

Each packet includes ATS URL/provider, resume/material excerpts, saved profile
answers, and the latest receipt for that job.

## Receipts

`GET /api/apply-agent/receipts`

Returns receipts. Supports the same `job_id` / `job_ids` filters.

`POST /api/apply-agent/receipts`

```json
{
  "queue_id": "queue_123",
  "confirmation_text": "Submitted in ATS",
  "confirmation_url": "https://ats.example/confirmation"
}
```

Records a manual submitted receipt, marks the queue `submitted`, and moves the
tracked application to `applied`.

## Extension Receipts

The Chrome extension uses these session-authenticated routes with the same
review-first boundary:

`POST /api/extension/apply-packet`

```json
{ "url": "https://jobs.lever.co/acme/1" }
```

Returns the tracked job packet for the current ATS page.

`POST /api/extension/fill-receipt`

Records an assisted-fill attempt. Successful fills create `filled` receipts and
move the queue to `ready_to_submit`. Failed fills create `failed` receipts with
`failure_reason` and move the queue to `failed`. `uploaded_files` records files
the user explicitly selected in the extension popup; `upload_fields` records
remaining manual file inputs.

`POST /api/extension/submission-receipt`

Records a submitted or failed submit receipt after manual confirmation capture
or reviewed extension submit.

```json
{
  "job_id": "job_123",
  "original_url": "https://jobs.lever.co/acme/1",
  "confirmation_url": "https://jobs.lever.co/acme/thanks",
  "confirmation_text": "Thanks for applying.",
  "provider": "lever",
  "status": "submitted",
  "mode": "Extension reviewed submit"
}
```

`status` defaults to `submitted`. Send `status: "failed"` with
`failure_reason` when reviewed submit was blocked or no ATS confirmation was
detected; failed receipts do not mark the job applied.

## Boundary

These routes and extension actions do not upload unattended files, bypass
captchas, or run unattended bulk apply. The extension can attach only files the
user explicitly selected in the popup. Reviewed submit can click a visible
submit button only after explicit user confirmation and conservative preflight
checks.
