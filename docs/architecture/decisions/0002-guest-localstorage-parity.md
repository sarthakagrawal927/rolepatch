---
title: ADR-0002 — Guest localStorage parity with D1
---

# ADR-0002 — Guest localStorage parity with D1

**Date:** 2026-02-23
**Status:** accepted

## Context

The product thesis is "try everything without signing up." Every core
flow (resume editor, tailor, cover letter, interview prep, evidence,
stash, job discovery, apply-agent queue) must work for unauthenticated
guests. Signed-in users persist to Cloudflare D1 with `user_id`
filtering. The two paths must be symmetric so server actions can branch
on `getCurrentUserId()` without forking the whole UI.

## Decision

Maintain a parallel `localStorage` data layer
(`src/lib/local-storage.ts`) that mirrors the D1 layer's interface via
generic `getItems` / `setItems` helpers. Server actions in
`src/lib/actions/` call `getCurrentUserId()` and branch: null →
localStorage, non-null → D1 with `WHERE user_id = ?`. On first sign-in,
`migration-actions.ts` bulk-inserts localStorage data into D1 and clears
the `rt-*` keys.

## Consequences

- **Positive:** Full guest experience, no sign-up friction, no backend
  cost for guests. Migration to signed-in is one server action.
- **Negative:** Every new entity needs both a D1 schema entry and a
  localStorage implementation, plus a migration path. Guest data is
  device-bound (cleared with browser data).
- **Watch for:** Guest writes must never touch D1, and guest reads must
  never return another guest's data. The 2026-03-29
  [security audit](../../knowledge/security-audit.md) found and fixed
  unauthenticated-write leaks and `WHERE user_id IS NULL` cross-guest
  read leaks — do not reintroduce them.

## Alternatives considered

- **Anonymous server-side sessions** — rejected: adds backend cost and
  a session table for guests, against the local-first thesis.
- **Sign-up wall** — rejected: kills the try-before-sign-up funnel.
- **Guest = read-only** — rejected: the apply-agent queue and evidence
  bank need guest write parity to be useful.
