# agents.md — resume-tailor

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Purpose
LaTeX resume tailoring tool — job scraping + AI diff + cover letter generation. Users paste a job URL, AI rewrites their resume to match, with a Monaco diff view for review.

## Stack
- Framework: Next.js 16 (App Router), React 19
- Language: TypeScript
- Styling: Tailwind CSS v4
- DB: Turso (libSQL)
- Auth: better-auth (Google OAuth)
- Editor: CodeMirror (LaTeX editing) + Monaco (diff view)
- AI: Vercel AI SDK with OpenAI-compatible adapter (swappable `baseURL`)
- Scraping: Jina Reader (primary) + linkedom + Readability (fallback)
- Testing: Vitest (unit), Playwright (e2e)
- Deploy: Cloudflare Workers via OpenNext (`wrangler.toml` routes `rolepatch.com`)
- Package manager: pnpm

## Repo structure
```
src/
  app/
    landing/           # Public landing page (/)
    dashboard/         # Main app — resumes + jobs list
    editor/[id]/       # LaTeX editor with preview (CodeMirror)
    tailor/[jobId]/    # Scrape JD → AI tailor → diff view (Monaco)
    cover-letter/      # Cover letter generation
    stash/             # Extra content pool for AI
    settings/          # AI provider config
    api/auth/          # better-auth route ([...all] handler)
  components/          # React components (client-side)
  lib/
    actions/           # Server actions — all data mutations + AI calls
    auth.ts            # better-auth config
    auth-utils.ts      # getCurrentUserId() helper
    db.ts              # Turso client
    ai.ts              # AI provider setup (swappable baseURL)
    local-storage.ts   # Guest mode data layer
    types.ts           # TypeScript interfaces
    saasmaker.ts       # SaaS Maker SDK init
  styles/globals.css
```

## Key commands
```bash
pnpm dev      # next dev
pnpm build    # next build
pnpm start    # next start
pnpm lint     # biome check .
```

## Architecture notes
- **Server actions for all mutations** (`src/lib/actions/`). Each action calls `getCurrentUserId()` from `src/lib/auth-utils.ts`.
- **Guest vs signed-in**: full app works without auth via localStorage (`src/lib/local-storage.ts`). Signed-in users persist to Turso with `user_id` filtering.
- **AI provider**: single adapter in `src/lib/ai.ts` — supports free gateway, local AI, or BYOK via `baseURL` swap.
- **Scraping**: Jina Reader is primary; `linkedom` + `@mozilla/readability` as fallback.
- **SaaS Maker**: feedback widget + testimonials integrated. Config in `.saasmaker.json`. (SaaS Maker analytics removed — PostHog is the analytics path.)
- **Data model**: `users`, `resumes`, `job_applications`, `tailored_resumes`, `cover_letters`, `stash_entries`.
- All env vars documented in `.env.example`.

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
