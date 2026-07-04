# TrueHire Consolidation Pipeline PRD

Date: 2026-07-04

## Summary

RolePatch should carry a later consolidation lane for TrueHire instead of
deciding on a product merge before the apply-agent workflow is stable. The
likely winning shape is to keep TrueHire available as a distinct proof and
credibility project under the broader RolePatch ecosystem, preserve the parts of
its landing page and brand that work, and selectively connect its proof concepts
to RolePatch's evidence, receipts, and candidate proof surfaces.

This is intentionally a pipeline item, not an immediate repo merge. A complete
merge is only one possible outcome, and not the default.

## Why

RolePatch owns the job-seeker workflow: discovery, tailoring, application
packets, guarded submit, receipts, recruiter replies, and campaign tracking.
TrueHire appears to belong in the credibility layer: public proof profiles,
verification scores, and artifacts that help a candidate prove claims without
making unsupported resume statements.

Keeping TrueHire as a related but distinct project could also protect the
positioning that already works on its landing page. RolePatch can stay focused on
the job-search and apply-agent workflow, while TrueHire can remain the proof
front door for candidates who want credibility artifacts before or alongside an
application.

## Goals

- Inventory TrueHire's product surface, data model, API contracts, auth model,
  landing page, brand positioning, and verification artifacts before any
  migration decision.
- Define a canonical RolePatch proof model that can represent public proof
  profiles, verification scores, work samples, references, and claim evidence.
- Map verified TrueHire artifacts into RolePatch achievement evidence, application
  receipts, candidate proof packets, and recruiter reply context.
- Build a read-only import or preview path first, so users and operators can
  inspect the merged proof view before any destructive consolidation.
- Decide whether TrueHire should stay as a separate project under RolePatch,
  remain a standalone verification service, partially merge proof primitives, or
  retire only after proof surfaces are live.

## Non-Goals

- No immediate repo merge.
- No assumption that the TrueHire landing page should be discarded or absorbed
  into RolePatch's current marketing site.
- No production data migration without an approved migration plan.
- No schema migration until the TrueHire contracts are audited.
- No claim that TrueHire verification is available inside RolePatch until a
  shipped proof surface exists.
- No unattended sharing of proof artifacts with employers.
- No production secrets, OAuth credentials, or user files copied between products
  during planning.

## Product Fit

TrueHire should improve RolePatch only where it increases trust or conversion:

- **Separate proof front door:** TrueHire can remain a focused public credibility
  site while RolePatch handles the private apply-agent workflow.
- **Evidence bank:** verified artifacts can strengthen existing achievement
  evidence without inventing unsupported resume bullets.
- **Apply-agent packets:** packets can include optional proof links or verified
  claims selected by the user.
- **Receipts:** submitted application receipts can record which proof artifacts
  were included or intentionally excluded.
- **Candidate proof profile:** RolePatch can expose a shareable proof surface for
  recruiters when the user opts in.
- **Recruiter replies:** reply drafts can reference proof artifacts when a
  recruiter asks for validation, portfolio work, or employment details.

## Brand And Project Structure

Preferred direction:

- `/proof` is the first RolePatch-hosted seed for this direction: a public proof
  surface that frames TrueHire as the credibility layer without forcing an
  immediate merge.
- `/proof` now carries the stronger TrueHire landing-page thesis directly:
  tailored resumes are cheap, source-backed work is costly to fake, and the
  product-as-proof preview shows a candidate proof profile before the RolePatch
  import/review loop.
- Achievement evidence now has a derived proof-readiness layer, so existing
  evidence can move toward proof packets before any TrueHire data migration or
  verification-score import.
- `/proof` now includes a proof-packet preview backed by existing RolePatch
  evidence, giving the separate TrueHire-style project a useful signed-in and
  guest product loop before external verification exists.
- Application packets now consume that proof layer as optional user-provided
  proof items across dashboard/API/extension/guest paths, creating the first
  practical bridge between RolePatch applying and the separate TrueHire-style
  credibility project.
- Proof items in application packets are selected per job from role and job
  description overlap, so the bridge behaves like a relevance layer rather than
  a generic evidence attachment list.
- The TrueHire repo and current contracts are inventoried in
  `docs/plans/2026-07-04-truehire-contract-inventory.md`, including landing
  elements to preserve, public profile/export routes, schema boundaries, and
  privacy risks.
- `/proof` now includes a read-only TrueHire import preview that maps public
  `data.json` exports into proof candidates without saving, sharing, or attaching
  them to applications.
- Users can explicitly import previewed TrueHire proof candidates into the
  existing RolePatch achievement evidence bank. Signed-in imports write to Turso;
  guest imports write to localStorage; both are deduped and remain private until
  the user reviews and attaches them elsewhere.
- Manual application receipts now snapshot job-matched proof candidates available
  at review time, so the apply-agent audit trail records proof context without
  claiming that proof was automatically shared with the employer.
- Apply-agent packets now include a manual copy/export action for job-matched
  proof points, creating an explicit user-controlled proof sharing path while
  keeping automatic employer sharing unshipped.
- `/proof` now includes a standalone copyable proof-profile summary from
  shareable evidence, preserving source URLs and repeating the no-auto-share
  boundary outside the apply-agent packet drawer.
- Recruiter reply drafts now consume proof candidates only when the recruiter
  explicitly asks for proof, examples, GitHub, portfolio, references, or
  verification. This keeps proof sharing inside the existing editable reply flow
  instead of sending artifacts automatically.
- Keep TrueHire as a separate named project if its landing page, promise, and
  credibility-focused positioning are stronger than folding it into RolePatch.
- Treat RolePatch as the operating system for job applications and TrueHire as
  the proof layer that can plug into it.
- Preserve TrueHire's landing-page strengths during the audit, including the
  headline promise, visual structure, proof/verification language, and any
  conversion hooks that feel clearer than RolePatch's current proof messaging.
- Connect the products through explicit user-controlled proof links, imported
  evidence, and optional candidate proof packets before considering a deeper
  repo or data merge.
- Avoid confusing users with two competing dashboards. If TrueHire stays
  separate, it should have a clear role: public credibility and verification,
  not duplicate resume tailoring or apply-agent controls.

## Pipeline

### Phase 1: Audit

- Locate the TrueHire repo, production surface, database tables, auth model, and
  public profile routes.
- Capture the TrueHire landing page's strongest positioning, visual hierarchy,
  calls to action, trust signals, and proof-language patterns before making
  integration decisions.
- Inventory verification artifacts, score definitions, proof links, and any
  employer-facing claims.
- Identify overlap with RolePatch `achievement_evidence`, `application_receipts`,
  campaign notes, and public badge/profile surfaces.

Acceptance criteria:

- A contract inventory lists TrueHire tables/routes/artifacts and their RolePatch
  destination candidates.
- A landing-page/brand inventory identifies what should be preserved if TrueHire
  remains a separate project under RolePatch.
- Data that cannot be imported safely is marked explicitly.
- Any privacy, consent, or authenticity risks are called out before design work.

### Phase 2: Canonical Proof Model

- Define the minimal RolePatch proof object shape.
- Decide how proof confidence differs from fit score, evidence quality, and
  receipt confirmation.
- Choose whether proof links live on evidence records, receipt fields, a separate
  proof table, or a public profile surface.

Acceptance criteria:

- A mapping document shows how TrueHire proof maps into RolePatch data.
- Proof artifacts have source, owner, visibility, revocation, and timestamp
  fields.
- Sensitive or unverifiable artifacts are excluded by default.

### Phase 3: Read-Only Preview

- Build a local or signed-in preview that renders imported TrueHire proof without
  mutating existing applications.
- Show where the proof would appear in evidence, application packet, receipt, and
  recruiter reply contexts.
- Keep all proof sharing opt-in.

Acceptance criteria:

- Users can review the proof preview before any application or recruiter reply
  includes it.
- No employer-facing page is published by default.
- Preview failure leaves existing RolePatch workflows untouched.

### Phase 4: Consolidation Decision

- Compare maintenance cost of two projects against conversion value from proof
  surfaces and brand clarity.
- Decide whether to keep TrueHire as a separate project under RolePatch, merge
  only proof primitives into RolePatch, fully merge it, or retire it after
  export/import support exists.
- If merging, write a migration plan with rollback, user consent, and production
  verification steps.

Acceptance criteria:

- Product decision is explicit: separate project under RolePatch, partial proof
  merge, full merge, or retire.
- Any migration has a tested rollback path and no secret copying.
- RolePatch remains Cloudflare-first unless a specific proof workload requires an
  approved exception.

## Cloudflare-First Boundary

- Prefer Workers, Turso/libSQL, R2 for larger proof files if needed, and existing
  RolePatch auth/session paths.
- Keep shared AI or semantic work behind free-ai/Knowledgebase-style service
  boundaries.
- Do not add a new production dependency until the read-only preview proves real
  value.
- Do not deploy, migrate, or copy production data as part of this planning item.

## Open Questions

- Which TrueHire artifacts are user-owned versus employer- or verifier-owned?
- Are verification scores deterministic enough to preserve, or should RolePatch
  store only the underlying evidence and source metadata?
- Should candidate proof be a public page, a private recruiter link, or only a
  packet attachment in the first shipped slice?
- Does TrueHire have active users or production data that require a formal
  consent and export flow before consolidation?
