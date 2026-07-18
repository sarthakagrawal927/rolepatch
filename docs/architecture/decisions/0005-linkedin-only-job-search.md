---
title: ADR-0005 — LinkedIn-only native in-Worker job search
---

# ADR-0005 — LinkedIn-only native in-Worker job search

**Date:** 2026-06-10
**Status:** accepted

## Context

Job discovery needs a live job-search backend. The original
implementation was a Python sidecar (`api/python/`) wrapping
[python-jobspy](https://github.com/speedyapply/JobSpy) for multi-board
search (LinkedIn, Indeed, Glassdoor, etc.). Cloudflare Workers has no
Python runtime, so the sidecar could not run on the same deploy.

## Decision

Job search runs natively in the Worker via `src/lib/job-search.ts`,
which queries LinkedIn's public guest job-search endpoint (no API key)
and normalises results for the job-discovery UI. The Next.js route
`src/app/api/jobs/search/route.ts` calls it directly. Scope is
LinkedIn only.

## Consequences

- **Positive:** No sidecar, no second runtime, no second deploy. Single
  Worker handles search. Works for guests (no API key).
- **Negative:** LinkedIn only — no Indeed, Glassdoor, ZipRecruiter.
  Datacenter IP rate limits are possible; the fallback is Cloudflare
  Browser Rendering or a hosted job-search API (not yet wired).
- **Watch for:** If LinkedIn rate-limits the Worker's datacenter IP,
  do not add a broad retry loop. Prefer Browser Rendering fallback or
  a hosted API. Company watches can use supported career URLs
  independently of the LinkedIn search path.

## Alternatives considered

- **Keep the Python sidecar on a separate Node/Python host** —
  rejected: adds a second deploy target and operational surface for a
  feature that is not the product's core.
- **Hosted job-search API (SerpApi, etc.)** — deferred: cost and
  vendor lock-in; revisit if LinkedIn rate limits become a real
  blocker.
- **Browser Rendering for every search** — rejected: too slow for
  interactive search; reserve Browser Rendering for PDF export and
  apply-agent browser checks.
