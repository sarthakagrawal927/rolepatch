# agents.md — resume-tailor (RolePatch)

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Purpose

RolePatch — AI resume and job-application assistant. Paste a job URL,
get a resume rewritten to match. Cover letters, fit scores, STAR
interview stories, review-first apply-agent workflows, job discovery,
Chrome extension. Product: <https://rolepatch.com>.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
Cloudflare Workers via `@opennextjs/cloudflare` · Cloudflare D1 ·
better-auth (Google OAuth) · Vercel AI SDK (OpenAI-compatible adapter)
· CodeMirror · react-diff-viewer · Vitest · Playwright · pnpm.

## Essential commands

```bash
pnpm install
cp .env.example .env.local   # guest mode works without env
pnpm dev                     # http://localhost:3000
pnpm build                   # next build --webpack
pnpm cf:build                # full production build pipeline (Next + OpenNext + Astro overlay)
pnpm deploy                  # cf:build + wrangler deploy (production — ask before running)
pnpm lint                    # biome check .
pnpm typecheck               # tsc --noEmit
pnpm test                    # vitest run
pnpm test:e2e                # playwright
pnpm release:verify          # full local preflight before publish
pnpm smoke:prod              # production smoke (public + optional auth)
pnpm verify:deploy-routes    # verify built manifest has parity-critical routes
pnpm docs:check              # docs link + frontmatter + structure validation
pnpm docs:build              # Blume build → dist/ (presentation layer)
```

## Critical constraints

- **Server actions for all mutations** (`src/lib/actions/`). Each
  action calls `getCurrentUserId()` from `src/lib/auth-utils.ts` and
  branches: null → localStorage, non-null → D1 with `WHERE user_id = ?`.
  Guest writes never touch D1 — see
  [ADR-0002](docs/architecture/decisions/0002-guest-localstorage-parity.md)
  and [the security audit](docs/knowledge/security-audit.md).
- **Apply-agent is review-first by architecture.** No unattended bulk
  submit, no captcha bypass, no unattended file upload. See
  [ADR-0003](docs/architecture/decisions/0003-apply-agent-review-first.md).
- **Job search is LinkedIn-only, native in-Worker.** No Python sidecar
  (Workers has no Python runtime). See
  [ADR-0005](docs/architecture/decisions/0005-linkedin-only-job-search.md).
- **`/` is the Astro overlay, not the Next.js page.** `pnpm cf:build`
  overlays `landing-astro/dist/index.html` onto OpenNext assets. See
  [ADR-0004](docs/architecture/decisions/0004-astro-landing-overlay.md)
  and the [landing-astro runbook](docs/operations/runbooks/landing-astro.md).
  Do not delete `src/app/page.tsx` until the overlay is observably
  stable for ~a week.
- **`pnpm cf:build` is a multi-step pipeline.** A failure in any step
  (Next build → route verify → inline CSS → OpenNext → cache populate
  → Astro build → overlay) blocks deploy. See
  [development workflow](docs/development/workflow.md).
- **AI traffic routes through free-ai-gateway.** `AI_BASE_URL` in
  `wrangler.toml` points at `https://ai-gateway.sassmaker.com/v1`
  (Fleet-wide Workers AI chokepoint). Do not change without approval.
- **No deploys, migrations, secret rotation, or production config
  changes from agent sessions** unless the user explicitly asks. `main`
  stays releasable but is not an auto-production trigger for agent
  sessions.
- **Never commit secrets.** `.env*` is gitignored (except
  `.env.example`).

## Documentation navigation

The committed Markdown under `docs/` is the **source of truth** for
product knowledge, architecture, decisions, workflows, operations, and
durable learnings. Blume (`blume.config.ts`) is only the
presentation/search layer — generated output (`.blume/`, `dist/`) is
gitignored.

- **Navigation hub:** [`docs/index.md`](docs/index.md)
- **Short current view:** [`STATUS.md`](STATUS.md) · **Deep timeline:** [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
- **Product:** [`docs/product/overview.md`](docs/product/overview.md) · [`docs/product/surfaces.md`](docs/product/surfaces.md)
- **Architecture:** [`docs/architecture/overview.md`](docs/architecture/overview.md) · [`docs/architecture/data-model.md`](docs/architecture/data-model.md) · [ADRs](docs/architecture/decisions/)
- **Development:** [`docs/development/workflow.md`](docs/development/workflow.md) · [`docs/development/docs.md`](docs/development/docs.md)
- **Operations:** [`docs/operations/`](docs/operations/) (CI, deploy, smoke, release-verify, jobs, runbooks)
- **Knowledge:** [`docs/knowledge/`](docs/knowledge/) (learnings, failed-approaches, security-audit)
- **Archive:** [`docs/archive/`](docs/archive/) (superseded plans, PRDs, handoff notes)

### Documentation maintenance rules

1. **One canonical home per fact.** Don't re-explain what a doc already
   covers — link to it. Don't duplicate code-discoverable facts.
2. **Markdown is the source of truth.** Code/config stays authoritative
   for implementation details and schedules.
3. **Mark unresolved questions explicitly** in [`STATUS.md`](STATUS.md)
   — do not invent information.
4. **New non-obvious decision → new ADR** under
   `docs/architecture/decisions/` (use the
   [ADR template](docs/architecture/decisions/_template.md)). Never
   renumber; supersede with a new ADR that points back.
5. **Durable learnings** → `docs/knowledge/learnings/`. **Abandoned
   approaches** → `docs/knowledge/failed-approaches.md` with the reason.
6. **Prefer `docs/archive/<name>.md` over deletion.** Use `git mv` when
   reorganizing so rename history is kept.
7. **Keep pages 150–300 lines.** Split rather than grow.
8. **Validate before commit:** `pnpm docs:check` (CI runs it via
   `.github/workflows/docs.yml`).
9. **Do not edit generated Blume output** (`.blume/`, `dist/`). Edit
   the Markdown in `docs/` and rebuild.
10. **Status:** `STATUS.md` is the short view; `PROJECT_STATUS.md` is
    the durable fleet-mandated record. Update `PROJECT_STATUS.md` when
    PR-sized work completes; keep `STATUS.md` in sync.

<!-- FLEET-GUIDANCE:START -->

## Fleet Guidance

### Adding Tasks
- Add durable work items in SaaS Maker Cockpit Tasks when the task affects product behavior, deployment, user feedback, or fleet maintenance.
- Include the project slug, a concise title, acceptance criteria, priority/status, and links to relevant code, issues, traces, or dashboards.
- If task discovery starts locally in an editor or agent session, mirror the durable next step back into SaaS Maker before handoff.

### Using SaaS Maker
- Treat SaaS Maker as the system of record for project metadata, feedback, tasks, analytics, testimonials, changelog, and fleet visibility.
- Prefer API-first workflows through `fnd api`, the SDK, or widgets instead of one-off scripts when interacting with SaaS Maker features.
- Keep this agent file aligned with the project record when operating rules, integrations, or deployment conventions change.

### Free AI First
- Prefer free/local AI paths for routine development and analysis: the `free-ai` gateway, local models, provider free tiers, and cached context.
- Escalate to paid models only when complexity, correctness risk, or missing capability justifies the cost.
- Note any paid-AI use in the task or handoff when it materially affects cost, reproducibility, or future maintenance.

<!-- FLEET-GUIDANCE:END -->

## Active context
