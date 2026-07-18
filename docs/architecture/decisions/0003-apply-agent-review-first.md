---
title: ADR-0003 — Apply-agent is review-first, never unattended bulk
---

# ADR-0003 — Apply-agent is review-first, never unattended bulk

**Date:** 2026-07-03
**Status:** accepted

## Context

The apply-agent command center automates the repetitive part of job
application submission: scraping the ATS, pre-filling fields from saved
profile answers and resume materials, capturing receipts, and learning
reusable answers. The risk is building a tool that submits applications
unattended, bypasses captchas, or uploads files without user review —
which is both ethically fraught and a Terms-of-Service violation for
every major ATS.

## Decision

The apply-agent is **review-first by architecture, not by config flag.**

- Every submit is a single, explicit, user-triggered action.
- Browser checks (`/api/apply-agent/browser-check`) never submit.
- Guarded submit (`/api/apply-agent/browser-submit`) fills from saved
  answers/materials, then **refuses** to click submit when it detects:
  - CAPTCHA / human verification
  - Unfilled required fields
  - Outstanding file uploads
  - Missing submit button
- Ambiguous submit attempts create `failed` receipts for review, not
  silent `submitted` receipts.
- File upload assistance only uses files the user explicitly picked in
  the popup.
- There is no unattended bulk submit mode, no captcha bypass, no
  unattended file upload automation.

## Consequences

- **Positive:** Defensible against ATS ToS complaints. Users stay in
  control. Receipts are honest (submitted vs failed).
- **Negative:** Throughput is bounded by user review speed. Some ATS
  flows with captchas on every step are effectively manual.
- **Watch for:** Do not add a "skip review" or "auto-retry failed"
  config flag. Do not add captcha solving. Do not add file upload
  without an explicit popup picker. See
  [PROJECT_STATUS.md](../../../PROJECT_STATUS.md) → Out of scope for the
  durable list.

## Alternatives considered

- **Unattended bulk submit (Tsenta / Simplify / Massive model)** —
  rejected: ToS-violating, ethically fraught, and brittle against
  captchas. See
  [the similar-products research](../../archive/plans/2026-07-04-apply-agent-similar-products-research.md)
  for the competitive landscape and the ROI order.
- **Submit-with-captcha-solve** — rejected: captcha solving is a ToS
  violation and a moving target.
- **Submit-with-auto-upload** — rejected: uploading a user's resume
  without an explicit per-submit file pick is unsafe.
