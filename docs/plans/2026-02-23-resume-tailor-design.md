# Resume Tailor — Design Document

Date: 2026-02-23

## Overview

Web app for maintaining a LaTeX resume and generating job-tailored versions using AI. Scrapes job descriptions from any URL, generates tailored resumes with diff review, and produces cover letters with company research.

Personal-first, architected to grow to multi-user later.

## Stack

- **Framework**: Next.js (pnpm)
- **Database**: Turso (libsql)
- **AI**: Vercel AI SDK — single OpenAI adapter, different base URLs per provider
- **LaTeX editor**: CodeMirror with LaTeX syntax highlighting
- **LaTeX compiler**: Client-side WASM (SwiftLaTeX / texlive.js)
- **Diff view**: Monaco editor diff mode
- **HTML scraping**: linkedom + @mozilla/readability (same pattern as web-annotator)

## Architecture

```
Next.js App
├── Pages
│   ├── /                        — Dashboard (resumes, recent jobs)
│   ├── /editor/[id]             — LaTeX editor + compile-on-save PDF preview
│   ├── /tailor/[jobId]          — Scrape JD → AI tailor → diff view → accept
│   ├── /cover-letter/[jobId]    — Company research → AI cover letter → edit
│   └── /settings                — AI provider config, API keys
│
├── Server Actions / API Routes
│   ├── /api/scrape              — fetch URL + linkedom + Readability → clean text
│   ├── /api/tailor              — AI call to tailor resume against JD
│   ├── /api/cover-letter        — AI call to research company + generate letter
│   └── /api/resume/*            — CRUD via Turso
│
└── AI Provider (Vercel AI SDK, OpenAI adapter)
    ├── Free AI Gateway          — baseURL: CF worker (no key needed)
    ├── Local AI                 — baseURL: localhost:3456 (local auth)
    └── BYOK                     — baseURL: user-provided + API key
```

## AI Provider Configuration

All providers are OpenAI-compatible. Single Vercel AI SDK OpenAI adapter with swappable `baseURL`:

| Preset | Base URL | Auth |
|--------|----------|------|
| Free AI Gateway | `https://ai-gateway.sassmaker.com/v1` | Gateway key |
| Local AI | `http://localhost:3456/api` | None (local) |
| BYOK | User-provided | User-provided API key |

Settings UI lets user pick preset and optionally override model.

## Data Model (Turso)

### resumes
| Column | Type | Description |
|--------|------|-------------|
| id | text (pk) | UUID |
| name | text | Display name |
| latex_source | text | Raw .tex content |
| created_at | integer | Unix timestamp |
| updated_at | integer | Unix timestamp |

### job_applications
| Column | Type | Description |
|--------|------|-------------|
| id | text (pk) | UUID |
| resume_id | text (fk) | Base resume used |
| url | text | Original job link |
| company | text | Company name |
| role | text | Job title |
| jd_raw | text | Scraped HTML |
| jd_text | text | Clean plain text |
| status | text | draft / tailored / applied |
| created_at | integer | Unix timestamp |
| updated_at | integer | Unix timestamp |

### tailored_resumes
| Column | Type | Description |
|--------|------|-------------|
| id | text (pk) | UUID |
| job_id | text (fk) | Job application |
| resume_id | text (fk) | Original base resume |
| latex_source | text | AI-tailored .tex |
| accepted | integer | 0/1 user approved |
| created_at | integer | Unix timestamp |
| updated_at | integer | Unix timestamp |

### cover_letters
| Column | Type | Description |
|--------|------|-------------|
| id | text (pk) | UUID |
| job_id | text (fk) | Job application |
| resume_id | text (fk) | Resume used for context |
| content | text | Cover letter (markdown or LaTeX) |
| company_research | text | Cached research context |
| created_at | integer | Unix timestamp |
| updated_at | integer | Unix timestamp |

### Future tables (not building now)
- `applications_tracker` — status tracking, follow-ups, notes, salary
- `saved_searches` — job search queries and filters

## Core User Flows

### Flow 1: Create/Edit Resume
1. Dashboard → "New Resume"
2. LaTeX editor (CodeMirror) with syntax highlighting
3. Cmd+S → WASM compiles LaTeX → PDF preview updates
4. Auto-saved to Turso

### Flow 2: Tailor Resume for a Job
1. Select a resume → "Tailor for Job"
2. Paste job URL (or raw text as fallback)
3. Server action scrapes URL (linkedom + Readability)
4. Scraped JD shown for user review/edit
5. "Generate Tailored Resume" → AI call with base resume + JD
6. Diff view (Monaco): original LaTeX left, tailored right
7. User can accept all, edit inline, or reject
8. Save tailored version → compile → preview PDF

### Flow 3: Generate Cover Letter
1. From job page → "Generate Cover Letter"
2. AI scrapes company website (about page, values, blog)
3. AI generates cover letter using company research + JD + resume
4. User reviews/edits
5. Saved alongside the job application

### Flow 4: Application Tracking (future)
- List of jobs with status tracking
- Search/filter by company, role, status
- Job search integration

## AI Prompt Strategy

### Resume Tailoring
```
System: You are a resume tailoring expert. You receive a LaTeX resume
and a job description. Modify the resume content to better match the
job while keeping the LaTeX structure and formatting intact.
Only modify content sections (summary, experience bullets, skills).
Do not change the LaTeX preamble, layout commands, or formatting.
Return the complete modified LaTeX source.

User:
## Base Resume (LaTeX):
{latex_source}

## Job Description:
{jd_text}

## Instructions:
- Emphasize relevant experience and skills that match the JD
- Reword bullet points to use keywords from the JD where truthful
- Reorder skills to prioritize those mentioned in the JD
- Keep it honest — do not fabricate experience
```

### Cover Letter Generation
```
System: You are a professional cover letter writer. Using the
candidate's resume, the job description, and your research about
the company, write a compelling cover letter.

User:
## Resume:
{resume_content}

## Job Description:
{jd_text}

## Company Research:
{company_research}

## Instructions:
- Connect candidate's experience to the specific role
- Reference company values/mission where genuine
- Keep it concise (3-4 paragraphs)
- Professional but not generic
```

## HTML Scraping

Two-tier approach — Jina Reader as primary, Readability as fallback:

```typescript
async function scrapeForAI(url: string): Promise<string> {
  // Primary: Jina Reader (handles JS, returns clean markdown)
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown' },
    });
    if (res.ok) return await res.text();
  } catch (e) {
    console.warn('Jina Reader failed, falling back to Readability', e);
  }

  // Fallback: linkedom + Readability (static pages only)
  const html = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ...' },
  }).then(r => r.text());
  const { parseHTML } = await import('linkedom');
  const { Readability } = await import('@mozilla/readability');
  const { document } = parseHTML(html);
  const article = new Readability(document).parse();
  return article?.textContent ?? '';
}
```

- **Jina Reader**: Free 10M tokens, handles JS-rendered pages, returns LLM-optimized markdown
- **Readability fallback**: Same as web-annotator, for offline/rate-limited cases
- **Manual paste**: Always available as last resort

Research note: Firecrawl (YC S24) is the leading tool in this space but at $16-83/mo
is overkill for current needs. Revisit if anti-bot bypass or site-wide crawling is needed.
Consider building a reusable scraping CF Worker only if 5+ projects need this.

## Key Dependencies

- `next` — framework
- `ai` + `@ai-sdk/openai` — Vercel AI SDK
- `@libsql/client` — Turso driver
- `@mozilla/readability` + `linkedom` — HTML scraping fallback
- `@codemirror/lang-latex` — editor
- `monaco-editor` — diff view
- WASM LaTeX engine (SwiftLaTeX or texlive.js) — client-side compilation
