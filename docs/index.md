---
title: RolePatch docs
---

# RolePatch — documentation index

**RolePatch** is an AI resume and job-application assistant. Paste a job URL,
get a resume rewritten to match. Generate cover letters with company
research, fit scores, STAR interview stories, and run review-first
apply-agent workflows. Product: <https://rolepatch.com>.

This `docs/` tree is the canonical source of truth for product knowledge,
architecture, decisions, workflows, operations, and durable learnings.
Blume (`blume.config.ts`) is only the presentation + search layer over this
tree. Edit the Markdown here; never edit generated Blume output.

## Start here

- [Product overview](product/overview.md) — what RolePatch is, who it's for, scope.
- [App surfaces](product/surfaces.md) — every route and what it does.
- [STATUS.md](../STATUS.md) — short view: current objective, active work, blockers, next steps.
- [PROJECT_STATUS.md](../PROJECT_STATUS.md) — durable fleet-mandated status record (detail).
- [agents.md](../agents.md) — agent bootloader (commands, constraints, doc nav).

## Architecture

- [Architecture overview](architecture/overview.md) — topology, Worker entry, edge cache, dual runtimes.
- [Data model](architecture/data-model.md) — Cloudflare D1 schema and guest localStorage parity.
- [Decisions (ADRs)](architecture/decisions/) — recorded technical decisions and their rationale.

## Development

- [Development workflow](development/workflow.md) — setup, commands, testing, lint, build.
- [Working on docs](development/docs.md) — documentation rules, validation, Blume rendering.

## Operations

- [CI](operations/ci.md) — GitHub Actions gates (lint, test, cf:build, weekly quality).
- [Deploy](operations/deploy.md) — Cloudflare Workers deploy path, route verification, smoke.
- [Production smoke](operations/production-smoke.md) — public + authenticated smoke harness.
- [Release verify](operations/release-verify.md) — local preflight before publish.
- [Company-watchlist sync job](operations/jobs/company-watchlist-sync.md) — hourly cron.
- [Weekly digest job](operations/jobs/weekly-digest.md) — weekly cron + manual dispatch.
- [Apply-agent CLI + MCP runbook](operations/runbooks/apply-agent-cli.md) — HTTP API, CLI, MCP server.
- [Landing-astro overlay runbook](operations/runbooks/landing-astro.md) — Astro overlay during `cf:build`.

## Knowledge

- [Learnings](knowledge/learnings/) — study queue for non-obvious tech in this repo.
- [Failed approaches](knowledge/failed-approaches.md) — what we tried and abandoned, and why.
- [Security audit](knowledge/security-audit.md) — 2026-03-29 audit findings and dispositions.

## Archive

- [archive/](archive/) — superseded plans, PRDs, handoff notes, and old doc READMEs
  kept for git history. Not rendered as canonical Blume pages.

## How this tree is maintained

- **One fact, one home.** If a fact lives in code or config, link to it; do
  not restate it. If a fact lives here, do not duplicate it in `README.md`
  or `PROJECT_STATUS.md`.
- **New non-obvious decision → new ADR** under `architecture/decisions/`
  (use [the ADR template](architecture/decisions/_template.md)). Never
  renumber; supersede with a new ADR that points back.
- **Durable learnings** → `knowledge/learnings/`. **Abandoned approaches**
  → `knowledge/failed-approaches/` with the reason.
- **Keep pages short** (150–300 lines). Split rather than grow.
- **Run `pnpm docs:check` before committing doc changes.** CI runs the
  same gate (link check + structure validation).
- **Do not edit generated Blume output** (`.blume/`, `dist/`). Edit the
  Markdown in `docs/` and rebuild.
- **Preserve history.** Prefer `docs/archive/<name>.md` over deletion. Use
  `git mv` when moving docs so rename history is kept.
- **Status**: `STATUS.md` is the short view; `PROJECT_STATUS.md` is the
  durable fleet-mandated record. Update `PROJECT_STATUS.md` when PR-sized
  work completes; keep `STATUS.md` in sync as the short view.
