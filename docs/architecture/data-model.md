---
title: Data model
---

# Data model

Cloudflare D1 is the signed-in persistence layer. The schema lives in
`src/lib/db-schema.sql` (source of truth — do not duplicate it here).
This page documents the table groups, the guest parity contract, and
the non-obvious constraints.

## Tables

22 tables, grouped by concern:

| Group | Tables |
| --- | --- |
| **Identity** | `users` |
| **Resumes** | `resumes`, `tailored_resumes`, `cover_letters` |
| **Jobs** | `job_applications`, `saved_job_searches`, `saved_job_shortlist`, `job_discovery_alerts`, `company_watches` |
| **Evidence** | `achievement_evidence`, `interview_stories`, `skills_roadmaps`, `fit_scores`, `outreach_emails` |
| **Stash** | `stash_entries` |
| **Tokens / payments** | `token_balances`, `token_transactions`, `payments` |
| **Apply-agent** | `application_queue`, `application_receipts`, `profile_answers`, `recruiter_reply_events` |

For column-level detail, read `src/lib/db-schema.sql`. The single
migration is `migrations/0001_initial_schema.sql`.

## Guest parity contract

Every entity that exists in D1 has a parallel implementation in
`src/lib/local-storage.ts` under `rt-*` keys. The contract:

1. **Same interface.** `getItems` / `setItems` are generic helpers that
   mirror the DB layer interface, so server actions can swap between DB
   and localStorage based on `getCurrentUserId()`.
2. **Guest writes never touch D1.** Server actions throw if `userId` is
   null on a write path — see
   [the security audit](../knowledge/security-audit.md) for the
   historical unauthenticated-write leak that motivated this.
3. **Guest reads return empty/null for cross-user queries.** `WHERE
   user_id IS NULL` queries must return empty arrays or null for
   unauthenticated requests, never another guest's data.
4. **Migration on sign-in.** `src/lib/actions/migration-actions.ts`
   bulk-inserts localStorage data into D1 with the user's id on first
   sign-in, then clears the `rt-*` keys.

See [ADR-0002](decisions/0002-guest-localstorage-parity.md) for why this
dual layer exists.

## Token system

`token_balances` (per-user balance, atomic debit), `token_transactions`
(per-change ledger with `balance_after` snapshot), `payments` (Dodo
payment idempotency — `dodo payment_id` as PK, `INSERT OR IGNORE`
prevents double-credit). The atomic debit is a single SQL statement:

```sql
UPDATE token_balances
SET balance = balance - 1, total_used = total_used + 1, updated_at = unixepoch()
WHERE user_id = ? AND balance >= 1
RETURNING balance
```

Payment insert + token credit are wrapped in a single D1 transaction
(see [the security audit](../knowledge/security-audit.md) — the original
implementation had a no-transaction bug where a failed `creditTokens`
left a payment recorded but tokens never granted, and the idempotency
check prevented retry).

## Apply-agent tables

- `application_queue` — review-first queue entries with readiness state
  (`ready_to_submit`, `blocked`, `submitted`, etc.).
- `application_receipts` — submitted/failed receipts with final visible
  ATS field snapshots and machine-readable failure codes.
- `profile_answers` — reusable sensitive profile answers learned from
  successful submitted receipts (file/upload fields ignored).
- `recruiter_reply_events` — inbound recruiter replies routed via
  Cloudflare Email Routing to per-user forwarding addresses.

See [ADR-0003](decisions/0003-apply-agent-review-first.md) for the
review-first boundary and the [apply-agent CLI
runbook](../operations/runbooks/apply-agent-cli.md) for the HTTP API.

## Migrations

Wrangler D1 migrations. Apply with `wrangler d1 migrations apply rolepatch`
(production) — never run migrations from agent sessions without explicit
approval. The single migration is
`migrations/0001_initial_schema.sql`; `src/lib/db-schema.sql` is the
canonical schema source (idempotent `CREATE TABLE IF NOT EXISTS`).
