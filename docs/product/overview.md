---
title: Product overview
---

# Product overview

**RolePatch** — AI-powered resume tailoring and job-application assistant.
Product: <https://rolepatch.com>.

## What it is

A Next.js 16 app on Cloudflare Workers (via OpenNext) that helps job
seekers tailor resumes to specific job descriptions, generate cover
letters, research companies, score role fit, prepare STAR interview
stories, and run review-first apply-agent workflows. Users paste a job
URL; the AI rewrites their resume to match, with a `react-diff-viewer`
diff view for review.

## Who it's for

- **Job seekers (guest mode)** — full app works without auth via
  `localStorage`. No sign-up required to try every core flow.
- **Signed-in users (Google OAuth via better-auth)** — persistence to
  Cloudflare D1 with `user_id` filtering, token purchases, saved
  searches, company watches, recruiter reply routing.
- **Operators** — `rolepatch.com` Cloudflare Workers deploy, GitHub
  Actions auto-deploy on push to `main`, manual cron dispatch.

## Scope

**In scope:** Resume editor, tailoring, cover letters, interview prep,
tools hub (ATS check, keywords, bullet check, diff, snippets, word
count), campaign CRM, achievement evidence bank, saved-search /
company-watch alerts, recruiter reply routing, Dodo token checkout, PDF
export via Browser Rendering, review-first apply-agent queue / packet /
receipt workflows, Chrome extension.

**Out of scope:** Broad ATS/recruiter CRM, multi-board crawlers
(LinkedIn-only — see
[ADR-0005](../architecture/decisions/0005-linkedin-only-job-search.md)),
unattended bulk apply, unattended file upload automation, captcha
bypass, production Email Routing rule setup, aggressive scraping without
endpoint evidence.

## Core flows

1. **Tailor** — paste job URL → scrape JD (Jina Reader + Readability
   fallback) → AI rewrites resume → diff view → accept / edit / save.
   Costs 1 token for signed-in users.
2. **Cover letter** — same job + resume → AI generates cover letter with
   company research. Costs 1 token.
3. **Interview prep** — STAR+R story generation from the job + resume.
4. **Job discovery** — native in-Worker LinkedIn search (no API key),
   resume-aware semantic ranking via the shared Knowledgebase RAG
   service, saved searches, company watches, alerts.
5. **Apply-agent command center** — review-first queue: save jobs, build
   packets, run reviewed browser checks, guarded single submit attempts,
   capture receipts, learn reusable profile answers. Never unattended
   bulk apply.
6. **Tools hub** — free, local-only tools (ATS check, keywords, bullet
   check, diff, snippets, word count) for SEO + agent indexing.

## Monetization

Token-based via Dodo Payments. 3 free tokens on sign-up; packs of 10 /
30 / 100 tokens. Each tailor or cover-letter generation costs 1 token.
Everything else is free. See
[the token system ADR](../architecture/decisions/0003-apply-agent-review-first.md)
context and `src/lib/actions/token-actions.ts` for the atomic debit
implementation.

## Deployment surface

- **Hosting:** Cloudflare Workers (`resume-tailor`) via
  `@opennextjs/cloudflare`, custom domain `rolepatch.com`.
- **Database:** Cloudflare D1 (binding `DB`).
- **Auth:** better-auth + Google OAuth.
- **AI:** free-ai-gateway (Fleet-wide Workers AI chokepoint) via Vercel
  AI SDK / OpenAI-compatible adapter.
- **Payments:** Dodo Payments (hosted checkout + HMAC webhooks).
- **PDF:** Cloudflare Workers Browser Rendering binding (`BROWSER`).
- **Email:** Cloudflare Email Routing for inbound recruiter replies.
- **Landing overlay:** Astro static landing overlaid onto the Next.js
  build during `cf:build` for fleet perf on `/` (see
  [the landing-astro runbook](../operations/runbooks/landing-astro.md)).

See [architecture overview](../architecture/overview.md) for topology,
[app surfaces](surfaces.md) for the full route map, and
[development workflow](../development/workflow.md) for commands.
