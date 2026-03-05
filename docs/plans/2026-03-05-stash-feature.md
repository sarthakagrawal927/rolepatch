# Stash Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Stash" feature — a pool of extra resume content blocks (experience, skills, projects, etc.) that the AI considers when tailoring resumes for specific jobs.

**Architecture:** New `stash_entries` DB table, new server actions file for CRUD, new `/stash` page with grouped list + modal for add/edit/delete, and prompt augmentation in `tailor-action.ts`.

**Tech Stack:** Next.js App Router, Turso/LibSQL, Tailwind CSS, React server actions

---

### Task 1: Database Schema — Add `stash_entries` table

**Files:**
- Modify: `src/lib/db-schema.sql` (append new table)
- Modify: `src/lib/types.ts` (add interface)

**Step 1: Add table to schema**

Append to `src/lib/db-schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS stash_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'experience',
  label TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Step 2: Add TypeScript interface**

Add to `src/lib/types.ts`:

```typescript
export interface StashEntry {
  id: string;
  category: string;
  label: string;
  content: string;
  created_at: number;
  updated_at: number;
}
```

**Step 3: Run migration**

```bash
pnpm tsx src/lib/db-migrate.ts
```

Expected: "Migration complete" (no errors)

**Step 4: Commit**

```bash
git add src/lib/db-schema.sql src/lib/types.ts
git commit -m "feat(stash): add stash_entries table and type"
```

---

### Task 2: Server Actions — CRUD for stash entries

**Files:**
- Create: `src/lib/actions/stash-actions.ts`

**Step 1: Create server actions file**

```typescript
'use server';

import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { StashEntry } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function listStashEntries(): Promise<StashEntry[]> {
  const result = await db.execute('SELECT * FROM stash_entries ORDER BY category, created_at DESC');
  return JSON.parse(JSON.stringify(result.rows)) as StashEntry[];
}

export async function createStashEntry(
  category: string,
  label: string,
  content: string,
): Promise<string> {
  const id = uuid();
  await db.execute({
    sql: 'INSERT INTO stash_entries (id, category, label, content) VALUES (?, ?, ?, ?)',
    args: [id, category, label, content],
  });
  revalidatePath('/stash');
  return id;
}

export async function updateStashEntry(
  id: string,
  category: string,
  label: string,
  content: string,
): Promise<void> {
  await db.execute({
    sql: 'UPDATE stash_entries SET category = ?, label = ?, content = ?, updated_at = unixepoch() WHERE id = ?',
    args: [category, label, content, id],
  });
  revalidatePath('/stash');
}

export async function deleteStashEntry(id: string): Promise<void> {
  await db.execute({ sql: 'DELETE FROM stash_entries WHERE id = ?', args: [id] });
  revalidatePath('/stash');
}
```

**Step 2: Verify build**

```bash
pnpm build 2>&1 | tail -5
```

Expected: "Compiled successfully"

**Step 3: Commit**

```bash
git add src/lib/actions/stash-actions.ts
git commit -m "feat(stash): add CRUD server actions"
```

---

### Task 3: Stash Page — `/stash` with grouped list and add/edit/delete modals

**Files:**
- Create: `src/app/stash/page.tsx` (server component — fetches data, renders client component)
- Create: `src/components/stash-list.tsx` (client component — modal logic, grouped display)

**Step 1: Create the page**

`src/app/stash/page.tsx`:

```typescript
export const dynamic = 'force-dynamic';

import { listStashEntries } from '@/lib/actions/stash-actions';
import { StashList } from '@/components/stash-list';

export default async function StashPage() {
  const entries = await listStashEntries();

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Stash</h1>
      </div>
      <p className="text-gray-500 mb-8">
        Extra content blocks the AI can pull from when tailoring your resume for specific jobs.
      </p>
      <StashList entries={entries} />
    </main>
  );
}
```

**Step 2: Create the client component**

`src/components/stash-list.tsx` — This is the largest piece. It should:

- Accept `entries: StashEntry[]` prop
- Group entries by `category` and display under category headings
- Show each entry as a card with label + content preview (first 2 lines)
- "Add Entry" button at top opens a modal with:
  - Category dropdown: experience, skills, projects, education, certifications, other
  - Label text input
  - Content textarea (Markdown)
  - Save button calls `createStashEntry`
- Click on an entry card opens edit modal (same form, pre-filled) with save + delete buttons
- Modal pattern: match `new-job-button.tsx` style (backdrop, white card, escape to close)
- Category headings styled as section headers

The preset categories array:

```typescript
const CATEGORIES = ['experience', 'skills', 'projects', 'education', 'certifications', 'other'];
```

Modal form fields use the same Tailwind classes as `new-job-button.tsx`:
- Input: `w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500`
- Button primary: `px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors`
- Button cancel: `px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors`
- Delete button: `px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors`

**Step 3: Verify dev server**

```bash
curl -s http://localhost:3000/stash | grep -c 'Stash'
```

Expected: at least 1 match

**Step 4: Commit**

```bash
git add src/app/stash/page.tsx src/components/stash-list.tsx
git commit -m "feat(stash): add /stash page with grouped list and modals"
```

---

### Task 4: Nav Link — Add "Stash" to the navigation bar

**Files:**
- Modify: `src/app/layout.tsx:36-42` (add link after Settings)

**Step 1: Add Stash link**

In `src/app/layout.tsx`, after the Settings `<Link>` (line 36-41), add:

```tsx
<Link
  href="/stash"
  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
>
  Stash
</Link>
```

**Step 2: Verify in browser**

Navigate to `http://localhost:3000` — "Stash" should appear in the nav bar.

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(stash): add Stash link to nav bar"
```

---

### Task 5: Tailoring Integration — Feed stash to the AI prompt

**Files:**
- Modify: `src/lib/actions/tailor-action.ts` (add stash to prompt)
- Modify: `src/components/tailor-flow.tsx:29` (no changes needed — tailorResume is called server-side)

**Step 1: Modify tailor action**

Update `src/lib/actions/tailor-action.ts` to:

```typescript
'use server';

import { generateText } from 'ai';
import { getAIProvider } from '@/lib/ai';
import type { AIProviderConfig } from '@/lib/types';
import { listStashEntries } from '@/lib/actions/stash-actions';

export async function tailorResume(
  resumeSource: string,
  jdText: string,
  aiConfig?: Partial<AIProviderConfig>,
): Promise<string> {
  const { provider, model } = getAIProvider(aiConfig);

  const stashEntries = await listStashEntries();
  let stashSection = '';
  if (stashEntries.length > 0) {
    const formatted = stashEntries
      .map((e) => `### [${e.category}] ${e.label}\n${e.content}`)
      .join('\n\n');
    stashSection = `\n\n## Additional Content Available (not currently in resume):\nThe following are extra content blocks the user has stashed. You may incorporate any of these into the tailored resume if they are relevant to the job description. Only use them if they genuinely strengthen the resume for this specific role.\n\n${formatted}`;
  }

  const { text } = await generateText({
    model: provider(model),
    system: `You are a resume tailoring expert. You receive a Markdown resume and a job description. Modify the resume content to better match the job while keeping the Markdown structure intact. Only modify content (summary, experience bullets, skills). Do not change headings or structure. Return ONLY the complete modified Markdown, no explanation.`,
    prompt: `## Base Resume (Markdown):\n${resumeSource}\n\n## Job Description:\n${jdText}${stashSection}\n\n## Instructions:\n- Emphasize relevant experience and skills that match the JD\n- Reword bullet points to use keywords from the JD where truthful\n- Reorder skills to prioritize those mentioned in the JD\n- If any stashed content is highly relevant to the JD, incorporate it naturally into the appropriate resume section\n- Keep it honest — do not fabricate experience`,
  });

  return text;
}
```

**Step 2: Verify build**

```bash
pnpm build 2>&1 | tail -5
```

Expected: "Compiled successfully"

**Step 3: Commit**

```bash
git add src/lib/actions/tailor-action.ts
git commit -m "feat(stash): feed stash entries into AI tailoring prompt"
```

---

### Task 6: Verify end-to-end

**Step 1:** Navigate to `/stash`, add an entry (category: "experience", label: "Test Entry", content: some markdown)
**Step 2:** Verify it appears grouped under "experience"
**Step 3:** Edit the entry, verify changes persist
**Step 4:** Navigate to a job's tailor page, generate a tailored resume — verify no errors (stash content is silently included in the prompt)
**Step 5:** Delete the test entry, verify it's removed

No commit for this task — it's manual verification only.
