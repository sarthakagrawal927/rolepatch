---
title: Working on docs
---

# Working on docs

The committed Markdown under `docs/` is the **source of truth** for
product knowledge, architecture, decisions, workflows, operations, and
durable learnings. Blume (`blume.config.ts`) is only the presentation +
search layer — generated output (`.blume/`, `dist/`) is gitignored and
never committed.

## Rules

1. **One fact, one home.** If a fact lives in code or config, link to
   it; do not restate it. If a fact lives in `docs/`, do not duplicate
   it in `README.md` or `PROJECT_STATUS.md`.
2. **Markdown is the source of truth.** Code/config stays authoritative
   for implementation details and schedules.
3. **Don't duplicate code-discoverable facts.** Link to the file or
   command.
4. **Mark unresolved questions explicitly** in
   [`STATUS.md`](../../STATUS.md) — do not invent information.
5. **New non-obvious decision → new ADR** under
   [`architecture/decisions/`](../architecture/decisions/) (use the
   [ADR template](../architecture/decisions/_template.md)). Never
   renumber; supersede with a new ADR that points back.
6. **Durable learnings** → `knowledge/learnings/`. **Abandoned
   approaches** → `knowledge/failed-approaches/` with the reason.
7. **Prefer `docs/archive/<name>.md` over deletion** so git rename
   history survives. Use `git mv` when reorganizing.
8. **Keep pages short** (150–300 lines). Split rather than grow.
9. **Every docs Markdown file needs a `title` in frontmatter** — Blume
   renders it as the page heading. The validator enforces this.
10. **Archive is excluded from Blume rendering.** `docs/archive/**` is
    preserved for git history and reachable via the repo, not as
    canonical pages.

## Validate

```bash
pnpm docs:check    # link check + frontmatter + structure validation
pnpm docs:build    # Blume build → dist/ (presentation layer)
```

CI runs `pnpm docs:check` on every push / PR via
[the docs workflow](../../.github/workflows/docs.yml).

The validator (`scripts/check-docs.mjs`) enforces:

1. Every docs Markdown file has a `title` in frontmatter (Blume renders
   it). Archive files are exempt.
2. Every relative Markdown link resolves to a file that exists.
3. `docs/index.md` exists.
4. No empty `docs/` subdirectories.

## Blume rendering

Blume is the presentation + search layer. It renders the committed
`docs/` tree as a static docs site with search (Orama), `llms.txt` for
agent crawlers, sitemap, robots, and OG. Generated output (`.blume/`,
`dist/`) is gitignored — never edit it; edit the Markdown and rebuild.

```bash
pnpm docs:build    # → dist/
pnpm docs:dev      # → http://localhost:3000 (Blume dev server)
```

The Blume config is `blume.config.ts` at repo root. It is **not** the
source of truth — it only configures how `docs/` is rendered. If a doc
change requires a Blume config change (e.g. a new content root), edit
the config to fit the docs, not the docs to fit the config.

## When to update what

| Change | Update |
| --- | --- |
| New route added/removed | [`product/surfaces.md`](../product/surfaces.md) |
| New D1 table | [`architecture/data-model.md`](../architecture/data-model.md) + `src/lib/db-schema.sql` |
| Non-obvious decision | New ADR under [`architecture/decisions/`](../architecture/decisions/) |
| New cron / scheduled job | [`operations/jobs/`](../operations/jobs/) |
| New runbook | [`operations/runbooks/`](../operations/runbooks/) |
| Durable learning | [`knowledge/learnings/`](../knowledge/learnings/) |
| Abandoned approach | [`knowledge/failed-approaches.md`](../knowledge/failed-approaches.md) |
| PR-sized work completed | [`PROJECT_STATUS.md`](../../PROJECT_STATUS.md) (durable) + [`STATUS.md`](../../STATUS.md) (short view) |
| Superseded doc | Move to `docs/archive/` with a `stale-` prefix and a one-line supersession note |

Do **not** update docs for minor edits or bug fixes that don't change
documented architecture or conventions.
