# Four Features — Design Spec

Date: 2026-03-15

## 1. Test Setup (Vitest + Playwright)

### Unit Tests (Vitest)
- Config: `vitest.config.ts` with path aliases matching `tsconfig.json`
- Test files: `__tests__/` directory at project root
- Initial tests:
  - `local-storage.test.ts` — CRUD for all entity types, SSR safety
  - `ai.test.ts` — provider config resolution (env vars, overrides, defaults)
  - `types.test.ts` — type guards if any

### E2E Tests (Playwright)
- Config: `playwright.config.ts` with local dev server
- Test files: `e2e/` directory at project root
- Initial test: `resume-flow.spec.ts` — create resume → edit → verify save (guest mode, no auth needed)

### Dependencies
- `vitest`, `@testing-library/react`, `jsdom` (dev)
- `@playwright/test` (dev)
- Scripts: `"test": "vitest"`, `"test:e2e": "playwright test"`

## 2. PDF Export

### Approach
Use `window.print()` — the editor already renders paginated preview with calculated page breaks and has print CSS (`@media print`).

### Changes
- Add "Export PDF" button in `resume-editor.tsx` toolbar (next to save button)
- Button calls `window.print()`
- Ensure print styles hide editor panel, toolbar, and show only the preview pages continuously
- Add `@media print` rules to `globals.css` if not already sufficient

### No new dependencies needed.

## 3. Application Tracking UI

### Status Values
Expand from `draft | tailored | applied` to: `draft | tailored | applied | interview | offer | rejected`

### Changes
- **types.ts**: Update `JobApplication.status` union type
- **Dashboard**: Status badge with dropdown to change status inline
- **job-actions.ts**: New `updateJobStatus(id, status)` server action
- **local-storage.ts**: New `localUpdateJobStatus(id, status)` function
- **db-schema.sql**: No change needed (status is TEXT, any value works)

### UI
- Dashboard job cards get a clickable status badge
- Clicking opens a dropdown with all status options
- Color scheme: draft=gray, tailored=blue, applied=yellow, interview=purple, offer=green, rejected=red

## 4. Guest → Signed-in Data Migration

### Trigger
On dashboard load, if user is signed-in AND localStorage has `rt-*` keys with data, show a migration banner.

### Flow
1. Detect: Check if any `rt-resumes`, `rt-jobs`, etc. have data
2. Prompt: Show banner "We found local data. Import to your account?"
3. Migrate: New `migrateGuestData()` server action that:
   - Accepts all entity arrays (resumes, jobs, tailored, cover letters, stash)
   - Bulk inserts with user_id set to current user
   - Returns success/failure count
4. Cleanup: Clear all `rt-*` keys from localStorage on success
5. Refresh: Reload dashboard data from server

### Server Action
`src/lib/actions/migration-actions.ts`:
- `migrateGuestData(data: { resumes, jobs, tailoredResumes, coverLetters, stashEntries })`
- Uses transaction for atomicity
- Skips duplicates (ON CONFLICT DO NOTHING on id)

### Component
`src/components/migration-banner.tsx`:
- Client component, checks localStorage on mount
- Shows count of items found
- "Import" and "Dismiss" buttons
- Dismiss sets a `rt-migration-dismissed` flag
