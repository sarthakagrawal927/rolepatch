# TrueHire Contract Inventory

Date: 2026-07-04

Source repo inspected: `/Users/sarthak/Desktop/fleet/truehire`

This inventory grounds the RolePatch proof lane in the current TrueHire codebase.
It supports the separate-project direction: TrueHire remains the proof front door
while RolePatch consumes only user-controlled, read-only proof previews until a
real migration plan exists.

## Product Surface

| TrueHire surface | Current contract | RolePatch destination |
| --- | --- | --- |
| Landing page | `apps/web/src/app/page.tsx`; proof-first positioning: "Your resume is gone. Your work still speaks." | Preserve the proof-first language direction on `/proof`; do not fold it into the resume-tailoring landing by default |
| Public profile | `apps/web/src/app/[handle]/page.tsx`; profile at `/@handle`, score, evidence rail, risk flags, recruiter takeaway, Signal 2 employment, AI-build profile | Candidate proof profile or private recruiter link; first bridge is read-only preview on `/proof` |
| Public JSON export | `apps/web/src/app/[handle]/data.json/route.ts`; returns handle, GitHub IDs, latest score, activity months, work history | Safe import source for RolePatch preview because it avoids scraping HTML and needs no secrets |
| Role-fit JSON export | `apps/web/src/app/[handle]/role-fit/report.json/route.ts?jd=...` | Future RolePatch packet fit/explanation input; not yet wired |
| Badge / embed / CSV exports | `/badge.svg`, `/embed`, `/repos.csv` | Future optional proof link attachment; not included in application packets yet |
| Work-history API | `apps/web/src/app/api/work-history/route.ts` | Not imported directly; owner-authenticated and should stay in TrueHire until consent/migration exists |
| Verification request API | `apps/web/src/app/api/work-history/[id]/verify/route.ts` plus `/verify/[token]` | External verification remains unshipped in RolePatch; only confirmed public results may be previewed |

## Data Contracts

| TrueHire table/source | Meaning | Import posture |
| --- | --- | --- |
| `users` | GitHub OAuth identity, username, ingest status, claimed/seeded flags | Link by public handle only; no account merge yet |
| `scores` | Versioned public-work score with `overall`, Signal 1/2 values, axis scores, totals, `evidence_json`, `languages_json` | Map to proof summary and public-work proof candidates |
| `contributions` | Per-repo GitHub rollup and craft metadata | Do not query from RolePatch; consume summarized public export only |
| `activity_months` | Monthly GitHub activity used for depth/timeline | Summary context only; not a RolePatch achievement by itself |
| `work_history` | Candidate-entered roles | Do not treat as verified unless paired with confirmed verification |
| `employer_verifications` | Verification status, verifier domain, HMAC token hash, cryptographic signature | Confirmed entries can become proof candidates; pending/denied/disputed/expired stay out of packets |
| `ai_build_profiles` | Self-attested local AI-tool usage profile, explicitly score weight zero | May be displayed as self-attested context later; never mixed with verified proof score |
| `hiring_roles`, `hiring_pipelines`, `pipeline_candidates`, `candidate_evaluations` | Recruiter-side evaluation workflow | Keep separate; RolePatch already owns application campaign tracking |
| `cli_tokens`, `cli_auth_sessions` | TrueHire CLI publish auth | Do not copy; no RolePatch token sharing |

## Landing/Brand Elements To Preserve

- Costly-signal thesis: resumes are cheap; verified work is expensive to fake.
- Product-as-proof visual: the hero shows the actual profile, not abstract
  marketing art.
- Derived-not-declared language: avoid user-editable claims masquerading as
  verification.
- Transparent methodology: every number has a source and formula.
- Recruiter framing: "review evidence first" and source inspection are stronger
  than generic candidate-marketing copy.
- Clear disclaimers: GitHub score does not claim intelligence, culture fit, or
  interview performance.

## RolePatch Bridge Shipped

RolePatch now has a read-only TrueHire preview on `/proof`:

- API: `GET /api/proof/truehire-preview?handle=@handle`
- Mapper: `src/lib/truehire-proof.ts`
- UI: `src/components/truehire-proof-preview.tsx`

The bridge fetches only the allowed TrueHire public JSON export, maps public-work
evidence and confirmed work history into proof candidates, and does not publish,
submit, or attach any proof item to an application.

Users can now explicitly import previewed proof candidates into RolePatch
achievement evidence. Signed-in imports use Turso through the existing
achievement evidence action path, guests use localStorage, and duplicate imports
are skipped by source/title. Imported items remain private review material until
a later opt-in proof attachment flow ships.

## Privacy And Safety Boundaries

- No production data migration.
- No shared secrets or token copying.
- No arbitrary URL fetches; preview accepts only TrueHire handles/profile URLs.
- Pending, disputed, denied, or expired employer verification entries are not
  packet-ready proof.
- Self-attested AI-build data remains distinct from verified signals.
- RolePatch application packets may show proof candidates only as review context
  until explicit user-controlled proof links are shipped.
