---
title: Security audit (2026-03-29)
---

# Security audit — 2026-03-29

## Critical

- [x] **Guest data leak: unauthenticated writes** `src/lib/actions/job-actions.ts:17`
  `createJobApplication` does not reject when `userId` is null. Allows unauthenticated users to write directly to the database with `user_id = NULL`, creating orphan rows accessible to all guests.
  **Fix:** Throw if `userId` is null — guest writes should go through localStorage only.

- [x] **Guest data leak: unauthenticated writes (saveTailoredResume)** `src/lib/actions/job-actions.ts:56`
  Same issue — `saveTailoredResume` accepts null userId, writing unscoped rows to DB.
  **Fix:** Throw if `userId` is null.

- [x] **Guest data isolation: getCoverLetter** `src/lib/actions/cover-letter-action.ts:83-94`
  `WHERE job_id = ? AND user_id IS NULL` returns any guest's cover letter for a given jobId. Any user who guesses/knows a jobId can read another guest's data.
  **Fix:** Return null for unauthenticated requests.

- [x] **Guest data isolation: getTailoredResumes** `src/lib/actions/job-actions.ts:76-88`
  `WHERE job_id = ? AND user_id IS NULL` returns all guest tailored resumes for a given jobId.
  **Fix:** Return empty array for unauthenticated requests.

- [x] **Guest data isolation: getJobApplication** `src/lib/actions/job-actions.ts:28-35`
  `WHERE id = ? AND user_id IS NULL` — less severe since it requires the exact UUID, but still leaks any guest row by ID.
  **Fix:** Return null for unauthenticated requests (guest data lives in localStorage).

## High

- [x] **SSRF in scrape endpoint** `src/lib/actions/scrape-action.ts:14`
  `scrapeJobUrl` accepts any URL with no validation. Attacker can pass `http://169.254.169.254/...` (cloud metadata), `http://localhost:...`, or `file://` to probe internal network.
  Both the Jina proxy path (line 17) and the direct fetch fallback (line 37) are vulnerable.
  **Fix:** Validate URL: require `http(s)://`, block private/reserved IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, 0.0.0.0), block `localhost`.

- [x] **Payment webhook: no transaction** `src/app/api/webhook/dodo-payments/route.ts:57-72`
  Payment INSERT and `creditTokens` are separate operations. If `creditTokens` fails, the payment is recorded but tokens are never granted — and the idempotency check prevents retry.
  **Fix:** Wrap payment insert + token credit in a single DB transaction.

- [x] **Client-side payment verification** `src/components/pricing-cards.tsx:36`
  Success banner is triggered solely by `?success=true` query param — anyone can append it to see "Payment successful!" without paying.
  **Fix:** Verify server-side that a recent payment exists for the user before showing success.

## Medium

- [x] **No AI model allowlist** `src/lib/ai.ts:4`
  `getAIModel(modelOverride)` passes a client-controlled string directly to `google()`. Attacker could pass arbitrary model identifiers, potentially accessing expensive models or triggering unexpected behavior.
  **Fix:** Validate `modelOverride` against an allowlist of known model IDs.

- [ ] **No rate limiting on scrape endpoint** `src/lib/actions/scrape-action.ts:14`
  `scrapeJobUrl` has no rate limit. Attacker can abuse it as a free proxy to scrape arbitrary sites at scale.
  **Disposition:** Do not add broad or aggressive rate limiting by default. Prefer SSRF validation, ownership/auth checks, and provider cost controls; add a narrow throttle only if abuse is observed and approved.

## Low / Informational

- [x] **updateCoverLetter guest path** `src/lib/actions/cover-letter-action.ts:97-109`
  `WHERE id = ? AND user_id IS NULL` allows updating any guest cover letter by ID. Same pattern as read isolation issue.
  **Fix:** Reject unauthenticated requests.

- [ ] **SaasMaker project key committed** `.saasmaker.json:4`
  Contains `projectKey: "pk_..."`. This is a public-facing key (also in `NEXT_PUBLIC_SAASMAKER_API_KEY`), so likely low risk.
  **No fix needed** — public key by design.

- [ ] **No CORS configuration**
  No explicit CORS headers set in middleware or API routes. Next.js defaults to same-origin for API routes, which is fine. Server actions are POST-only with CSRF protection built into Next.js.
  **No fix needed** — defaults are secure.

- [ ] **Error messages may leak internals**
  Server action errors propagate raw messages to the client (e.g., DB errors). Not currently exploitable but could leak schema info.
  **Deferred** — not fixing now.

- [ ] **Limited test coverage for security paths**
  Existing tests cover ATS scoring, AI model setup, and localStorage. No tests for auth checks, rate limiting, or input validation on server actions.
  **Deferred** — should add integration tests for auth guards.

- [ ] **No secrets found in git history**
  Checked for API keys, tokens, and .env files in git history — none found. `.env*` is properly gitignored.
  **No fix needed.**
