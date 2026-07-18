# STATUS — short view

> **Durable record:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md) is the
> fleet-mandated status file (Why/What, Dependencies, Timeline,
> Products, Features, Todo/Planned/Deferred/Blocked). This file is the
> short view — keep it in sync, do not duplicate detail here.

**Last updated:** 2026-07-18

## Current objective

Keep RolePatch a stable, review-first AI resume + job-application
assistant on Cloudflare Workers, and consolidate the repo's knowledge
into one agent- and human-readable documentation system (this round).

## Active work

- Repository knowledge consolidation: canonical `docs/` tree, ADRs,
  runbooks, Blume presentation layer, docs validation + CI. (Branch
  `docs/knowledge-system`.)
- Marketing / agent-indexing surfaces: `llms.txt`, `llms-full.txt`,
  `/api/ai`, sitemap expansion, IndexNow key, FAQPage JSON-LD, blog
  nav + RSS feed (recent commits on `main`).

## Shipped recently

- Apply-agent / proof slice deployed (commit `5f5151c`); post-deploy
  `pnpm smoke:prod` passed 6/6 on 2026-07-04.
- Review-first apply-agent command center: queue, packets, reviewed
  browser checks, guarded single submit, receipts, profile-answer
  learning, automation health dashboard, provider reliability evidence.
- Native in-Worker LinkedIn job discovery with resume-aware semantic
  ranking via Knowledgebase RAG; guest parity for discovery.
- Chrome extension: save-to-queue, tailor, reviewed fill, reviewed
  submit, capture submitted receipt, canonical ATS URL matching.
- TrueHire proof-project preview integration (decision: keep TrueHire
  as a separate proof project; no deeper merge planned).

## Blockers

- (none currently)

## Unresolved questions

- Should the weekly digest and company-watchlist crons move from
  repo-local `wrangler.toml` to a fleet-level schedule? (No — they are
  RolePatch-specific; tracked as a question, not planned work.)
- Is a hosted job-search API (SerpApi, etc.) worth the cost if
  LinkedIn rate-limits the Worker's datacenter IP? Deferred until
  real rate-limit evidence appears.
- Live e2e coverage for credentialed payment / provider callback
  paths remains thin — add when production credentials and callback
  events are available.

## Next steps

1. Land `docs/knowledge-system` after human review (link check + docs
   validation green).
2. Wire the Blume docs site to a Cloudflare Pages project + custom
   domain when ready (presentation layer only; `docs/` stays source
   of truth).
3. Add deeper provider-specific apply-agent automation only after
   reviewed browser receipts have enough real failure-code evidence.
4. Revisit multi-board job search only if saved-search / company-watch
   engagement justifies it.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the full durable record.
