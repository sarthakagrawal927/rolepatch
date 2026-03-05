# Stash: Extra Content Pool for Resume Tailoring

## Problem
Users have work experience, skills, projects, and other resume content that doesn't fit on their primary resume but is relevant for specific job applications. Currently there's no way to store this extra content and have the AI consider it during tailoring.

## Design

### Data Model
New `stash_entries` table:
- `id` (TEXT PK)
- `category` (TEXT) — "experience", "skills", "projects", "education", "certifications", or custom
- `label` (TEXT) — short human-readable name, e.g. "ML Engineer at Startup X"
- `content` (TEXT) — Markdown block (same format as resume sections)
- `created_at`, `updated_at` (INTEGER)

Not tied to any specific resume — shared across all.

### UI: `/stash` page
- Top-level nav link alongside Settings
- List of stash entries grouped by category
- Each entry shows label + preview of content
- Add/edit/delete via modals (matching existing app pattern)
- Category selector when creating (dropdown of preset categories + custom option)

### Tailoring Integration
- `tailor-action.ts` prompt augmented with all stash entries
- Stash content passed in a labeled section: "Additional content available (not currently in resume)"
- AI decides whether to incorporate stashed content based on JD relevance
- No UI changes to the tailor page

### Out of Scope
- No drag-and-drop reordering
- No per-resume stash filtering
- No version history on stash entries
- No import from existing resume
