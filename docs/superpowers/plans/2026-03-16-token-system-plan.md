# Token System, Gemini Pro, Diff Upgrade & Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add token-based monetization (Dodo Payments), switch AI to Gemini Pro, replace Monaco diff with react-diff-viewer-continued, and redesign landing page hero to showcase the diff feature.

**Architecture:** Token balances are server-side only with atomic SQL operations. Dodo Payments handles checkout via hosted pages + webhooks. AI provider switches from OpenAI adapter to native Google Gemini SDK. Diff view moves from heavy Monaco editor to lightweight react-diff-viewer-continued with edit mode toggle.

**Tech Stack:** Next.js 16, Turso (libsql), Dodo Payments (@dodopayments/nextjs), Vercel AI SDK (@ai-sdk/google), react-diff-viewer-continued, standardwebhooks

**Spec:** `docs/superpowers/specs/2026-03-16-token-system-design.md`

**Read first:** `agents.md` for project context and patterns.

---

## Chunk 1: Database + Token Actions (Backend Foundation)

### Task 1: Schema & Migration

**Files:**
- Modify: `src/lib/db-schema.sql`
- Modify: `src/lib/db-migrate.ts`
- Test: `__tests__/token-actions.test.ts`

- [ ] **Step 1: Add new tables to schema**

Append to `src/lib/db-schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS token_balances (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  balance INTEGER NOT NULL DEFAULT 3,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tokens_granted INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  dodo_payload TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

- [ ] **Step 2: Run migration script to verify tables create**

Run: `npx tsx src/lib/db-migrate.ts`
Expected: "Migration complete" with no errors (CREATE IF NOT EXISTS is idempotent)

- [ ] **Step 3: Commit**

```bash
git add src/lib/db-schema.sql
git commit -m "feat: add token_balances, token_transactions, payments tables"
```

### Task 2: Token Server Actions

**Files:**
- Create: `src/lib/actions/token-actions.ts`
- Create: `__tests__/token-actions.test.ts`

- [ ] **Step 1: Write token action tests**

Create `__tests__/token-actions.test.ts` with tests for:
- `getTokenBalance` returns 0 when no user
- `initializeBalance` creates a row with balance=3
- `debitToken` returns success and decrements balance
- `debitToken` returns insufficient when balance is 0
- `creditTokens` increments balance and records transaction

Note: These will need to mock `db` and `getCurrentUserId`. Use `vi.mock`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- __tests__/token-actions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement token-actions.ts**

Create `src/lib/actions/token-actions.ts`:

```ts
'use server';

import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-utils';
import { v4 as uuid } from 'uuid';

export async function getTokenBalance(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;
  const result = await db.execute({
    sql: 'SELECT balance FROM token_balances WHERE user_id = ?',
    args: [userId],
  });
  return (result.rows[0]?.balance as number) ?? 0;
}

export async function initializeBalance(userId: string): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO token_balances (user_id, balance, total_purchased, total_used)
          VALUES (?, 3, 0, 0)`,
    args: [userId],
  });
  // Record signup bonus transaction
  const balance = 3;
  await db.execute({
    sql: `INSERT OR IGNORE INTO token_transactions (id, user_id, amount, type, balance_after)
          VALUES (?, ?, 3, 'signup_bonus', ?)`,
    args: [uuid(), userId, balance],
  });
}

export async function debitToken(
  type: 'tailor' | 'cover_letter',
  referenceId: string
): Promise<{ success: true; balance: number } | { success: false; error: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'not_authenticated' };

  // Atomic check-and-decrement
  const result = await db.execute({
    sql: `UPDATE token_balances
          SET balance = balance - 1, total_used = total_used + 1, updated_at = unixepoch()
          WHERE user_id = ? AND balance >= 1
          RETURNING balance`,
    args: [userId],
  });

  if (result.rows.length === 0) {
    return { success: false, error: 'insufficient_tokens' };
  }

  const newBalance = result.rows[0].balance as number;

  // Record transaction
  await db.execute({
    sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
          VALUES (?, ?, -1, ?, ?, ?)`,
    args: [uuid(), userId, type, referenceId, newBalance],
  });

  return { success: true, balance: newBalance };
}

export async function creditTokens(
  userId: string,
  amount: number,
  type: 'purchase' | 'refund' | 'signup_bonus',
  referenceId?: string
): Promise<number> {
  await db.execute({
    sql: `INSERT INTO token_balances (user_id, balance, total_purchased, total_used)
          VALUES (?, ?, ?, 0)
          ON CONFLICT(user_id) DO UPDATE SET
            balance = balance + ?,
            total_purchased = total_purchased + ?,
            updated_at = unixepoch()`,
    args: [userId, amount, amount, amount, amount],
  });

  const result = await db.execute({
    sql: 'SELECT balance FROM token_balances WHERE user_id = ?',
    args: [userId],
  });
  const newBalance = result.rows[0].balance as number;

  await db.execute({
    sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [uuid(), userId, amount, type, referenceId ?? null, newBalance],
  });

  return newBalance;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- __tests__/token-actions.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/token-actions.ts __tests__/token-actions.test.ts
git commit -m "feat: add token balance server actions with atomic debit"
```

### Task 3: Initialize Tokens on Sign-in

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Call initializeBalance in signIn callback**

In `src/lib/auth.ts`, after the user is upserted in the `signIn` callback, call `initializeBalance`. Import it from token-actions — but since auth.ts is not a server action file, import `db` directly and run the SQL inline (to avoid circular deps).

Add after the existing `INSERT INTO users` block:

```ts
// Initialize token balance for new users (3 free tokens)
await db.execute({
  sql: `INSERT OR IGNORE INTO token_balances (user_id, balance, total_purchased, total_used) VALUES (?, 3, 0, 0)`,
  args: [/* use the userId from the existing query result */],
});
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: initialize 3 free tokens on first sign-in"
```

## Chunk 2: Dodo Payments Integration

### Task 4: Install Dependencies & Env Vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env.local` (manually — add Dodo keys)

- [ ] **Step 1: Install Dodo packages**

Run: `pnpm add dodopayments @dodopayments/nextjs standardwebhooks`

- [ ] **Step 2: Update .env.example**

Add to `.env.example`:

```
# Dodo Payments
DODO_PAYMENTS_API_KEY=your-dodo-api-key
DODO_PAYMENTS_WEBHOOK_KEY=your-dodo-webhook-secret
DODO_PAYMENTS_RETURN_URL=http://localhost:3000/pricing?success=true
DODO_PAYMENTS_ENVIRONMENT=test_mode

# Dodo Product IDs (create in Dodo dashboard)
DODO_PRODUCT_STARTER=pdt_xxx
DODO_PRODUCT_PRO=pdt_xxx
DODO_PRODUCT_BULK=pdt_xxx
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example
git commit -m "chore: add Dodo Payments dependencies and env vars"
```

### Task 5: Checkout API Route

**Files:**
- Create: `src/app/api/checkout/route.ts`
- Create: `src/lib/token-config.ts`

- [ ] **Step 1: Create token config**

Create `src/lib/token-config.ts` — maps product IDs to token amounts:

```ts
export const TOKEN_PACKS = [
  { id: 'starter', name: 'Starter', tokens: 10, price: 500, priceLabel: '$5', perToken: '$0.50' },
  { id: 'pro', name: 'Pro', tokens: 30, price: 1200, priceLabel: '$12', perToken: '$0.40', popular: true },
  { id: 'bulk', name: 'Bulk', tokens: 100, price: 3000, priceLabel: '$30', perToken: '$0.30' },
] as const;

export function getProductId(packId: string): string | null {
  const envMap: Record<string, string | undefined> = {
    starter: process.env.DODO_PRODUCT_STARTER,
    pro: process.env.DODO_PRODUCT_PRO,
    bulk: process.env.DODO_PRODUCT_BULK,
  };
  return envMap[packId] ?? null;
}

export function getTokensForProduct(productId: string): number | null {
  for (const pack of TOKEN_PACKS) {
    const envId = getProductId(pack.id);
    if (envId === productId) return pack.tokens;
  }
  return null;
}
```

- [ ] **Step 2: Create checkout route**

Create `src/app/api/checkout/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import DodoPayments from 'dodopayments';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProductId } from '@/lib/token-config';

const client = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') ?? 'test_mode',
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { packId } = await request.json();
  const productId = getProductId(packId);
  if (!productId) {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const checkoutSession = await client.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { email: session.user.email, name: session.user.name ?? '' },
    return_url: process.env.DODO_PAYMENTS_RETURN_URL!,
    metadata: { user_id: (session as any).userId },
  });

  return NextResponse.json({ checkout_url: checkoutSession.checkout_url });
}
```

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/token-config.ts src/app/api/checkout/route.ts
git commit -m "feat: add Dodo Payments checkout route and token config"
```

### Task 6: Webhook Handler

**Files:**
- Create: `src/app/api/webhook/dodo-payments/route.ts`

- [ ] **Step 1: Create webhook handler**

Create `src/app/api/webhook/dodo-payments/route.ts`:

```ts
import { Webhook } from 'standardwebhooks';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { creditTokens } from '@/lib/actions/token-actions';
import { getTokensForProduct } from '@/lib/token-config';

const webhook = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY!);

export async function POST(request: Request) {
  const headersList = await headers();
  const rawBody = await request.text();

  // Verify webhook signature
  const webhookHeaders = {
    'webhook-id': headersList.get('webhook-id') ?? '',
    'webhook-signature': headersList.get('webhook-signature') ?? '',
    'webhook-timestamp': headersList.get('webhook-timestamp') ?? '',
  };

  try {
    webhook.verify(rawBody, webhookHeaders);
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventType = payload.type ?? payload.event_type;

  if (eventType === 'payment.succeeded' || eventType === 'payment_succeeded') {
    const paymentId = payload.data?.payment_id ?? payload.payment_id;
    const productId = payload.data?.product_id ?? payload.product_id;
    const userId = payload.data?.metadata?.user_id;
    const amountCents = payload.data?.amount ?? 0;
    const currency = payload.data?.currency ?? 'USD';

    if (!userId || !productId || !paymentId) {
      return new Response('Missing required fields', { status: 400 });
    }

    const tokensToGrant = getTokensForProduct(productId);
    if (!tokensToGrant) {
      return new Response('Unknown product', { status: 400 });
    }

    // Idempotent: INSERT OR IGNORE on payment_id PK
    const existing = await db.execute({
      sql: 'SELECT id FROM payments WHERE id = ?',
      args: [paymentId],
    });
    if (existing.rows.length > 0) {
      return new Response('Already processed', { status: 200 });
    }

    // Record payment
    await db.execute({
      sql: `INSERT INTO payments (id, user_id, product_id, amount_cents, currency, tokens_granted, status, dodo_payload)
            VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
      args: [paymentId, userId, productId, amountCents, currency, tokensToGrant, rawBody],
    });

    // Credit tokens
    await creditTokens(userId, tokensToGrant, 'purchase', paymentId);
  }

  if (eventType === 'payment.refunded' || eventType === 'payment_refunded') {
    const paymentId = payload.data?.payment_id ?? payload.payment_id;
    const payment = await db.execute({
      sql: 'SELECT user_id, tokens_granted FROM payments WHERE id = ? AND status = ?',
      args: [paymentId, 'completed'],
    });

    if (payment.rows.length > 0) {
      const row = payment.rows[0];
      const userId = row.user_id as string;
      const tokensToRevoke = row.tokens_granted as number;

      // Deduct tokens (floor at 0)
      await db.execute({
        sql: `UPDATE token_balances
              SET balance = MAX(0, balance - ?), updated_at = unixepoch()
              WHERE user_id = ?`,
        args: [tokensToRevoke, userId],
      });

      await db.execute({
        sql: `UPDATE payments SET status = 'refunded' WHERE id = ?`,
        args: [paymentId],
      });
    }
  }

  return new Response('OK', { status: 200 });
}
```

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhook/dodo-payments/route.ts
git commit -m "feat: add Dodo Payments webhook handler with idempotent token crediting"
```

## Chunk 3: Gemini Pro + Token Gating

### Task 7: Switch AI Provider to Gemini

**Files:**
- Modify: `src/lib/ai.ts`
- Modify: `src/lib/types.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Google AI SDK, remove OpenAI adapter**

Run: `pnpm add @ai-sdk/google && pnpm remove @ai-sdk/openai`

- [ ] **Step 2: Rewrite ai.ts for Gemini**

Replace `src/lib/ai.ts`:

```ts
import { google } from '@ai-sdk/google';

export function getAIModel(modelOverride?: string) {
  const model = modelOverride || process.env.AI_MODEL || 'gemini-2.5-pro';
  return google(model);
}
```

- [ ] **Step 3: Update AIProviderConfig type**

In `src/lib/types.ts`, simplify:

```ts
export interface AIProviderConfig {
  model: string;
}
```

Remove `baseURL` and `apiKey` fields.

- [ ] **Step 4: Build check**

Run: `pnpm build`
Expected: May have errors in tailor-action.ts and cover-letter-action.ts due to changed API — that's expected, fixed in next task.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts src/lib/types.ts package.json pnpm-lock.yaml
git commit -m "feat: switch AI provider from OpenAI adapter to Gemini Pro"
```

### Task 8: Add Token Gating to AI Actions

**Files:**
- Modify: `src/lib/actions/tailor-action.ts`
- Modify: `src/lib/actions/cover-letter-action.ts`

- [ ] **Step 1: Rewrite tailor-action.ts with token debit**

Replace `src/lib/actions/tailor-action.ts`:

```ts
'use server';

import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai';
import { listStashEntries } from '@/lib/actions/stash-actions';
import { debitToken, creditTokens } from '@/lib/actions/token-actions';
import { getCurrentUserId } from '@/lib/auth-utils';

export async function tailorResume(
  resumeSource: string,
  jdText: string,
  modelOverride?: string,
  stashContent?: string,
): Promise<string> {
  // Debit token before AI call
  const userId = await getCurrentUserId();
  let debited = false;
  if (userId) {
    const result = await debitToken('tailor', 'pending');
    if (!result.success) {
      throw new Error(result.error === 'insufficient_tokens'
        ? 'No tokens remaining. Purchase more to continue.'
        : 'Authentication required to generate.');
    }
    debited = true;
  }

  try {
    let stashSection = '';
    if (stashContent) {
      stashSection = `\n\n## Additional Content Available:\n${stashContent}`;
    } else {
      const stashEntries = await listStashEntries();
      if (stashEntries.length > 0) {
        stashSection = `\n\n## Additional Content Available:\n${stashEntries.map(e => `### [${e.category}] ${e.label}\n${e.content}`).join('\n\n')}`;
      }
    }

    const { text } = await generateText({
      model: getAIModel(modelOverride),
      system: `You are a resume tailoring expert. Modify the resume content to better match the job while keeping the Markdown structure intact. Only modify content. Return ONLY the complete modified Markdown, no explanation.`,
      prompt: `## Base Resume:\n${resumeSource}\n\n## Job Description:\n${jdText}${stashSection}\n\n## Instructions:\n- Emphasize relevant experience matching the JD\n- Reword bullets to use JD keywords where truthful\n- Reorder skills to prioritize JD matches\n- Incorporate relevant stashed content if available\n- Keep it honest — do not fabricate`,
    });

    return text;
  } catch (err) {
    // Refund token on AI failure
    if (debited && userId) {
      await creditTokens(userId, 1, 'refund', 'ai_failure');
    }
    throw err;
  }
}
```

- [ ] **Step 2: Update cover-letter-action.ts similarly**

Add token debit before the `generateText` call and refund in catch block. Update to use `getAIModel` instead of `getAIProvider`. Remove the `aiConfig` parameter, replace with optional `modelOverride`.

- [ ] **Step 3: Update tailor-flow.tsx**

In `handleGenerate`, remove the `aiConfig` parameter from the `tailorResume` call. Instead read just the model from settings:

```ts
const settings = JSON.parse(localStorage.getItem('ai-settings') ?? '{}');
const result = await tailorResume(resume.source, job.jd_text, settings.model, stashContent);
```

- [ ] **Step 4: Build and test**

Run: `pnpm build`
Expected: Build succeeds with all routes

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/tailor-action.ts src/lib/actions/cover-letter-action.ts src/components/tailor-flow.tsx
git commit -m "feat: add token gating to AI actions with failure refund"
```

## Chunk 4: Diff View Upgrade

### Task 9: Replace Monaco with react-diff-viewer-continued

**Files:**
- Modify: `src/components/resume-diff.tsx`
- Modify: `package.json`

- [ ] **Step 1: Swap dependencies**

Run: `pnpm add react-diff-viewer-continued && pnpm remove @monaco-editor/react`

- [ ] **Step 2: Rewrite resume-diff.tsx**

Replace `src/components/resume-diff.tsx`:

```tsx
'use client';

import { useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface Props {
  original: string;
  modified: string;
  onModifiedChange: (value: string) => void;
}

const darkTheme = {
  variables: {
    dark: {
      diffViewerBackground: '#0a0a0a',
      diffViewerColor: '#e5e5e5',
      addedBackground: '#0d2818',
      addedColor: '#4ade80',
      removedBackground: '#2d1215',
      removedColor: '#f87171',
      wordAddedBackground: '#166534',
      wordRemovedBackground: '#991b1b',
      addedGutterBackground: '#0d2818',
      removedGutterBackground: '#2d1215',
      gutterBackground: '#111111',
      gutterBackgroundDark: '#0d0d0d',
      highlightBackground: '#1a1a1a',
      highlightGutterBackground: '#1a1a1a',
      codeFoldGutterBackground: '#111111',
      codeFoldBackground: '#111111',
      emptyLineBackground: '#0a0a0a',
      gutterColor: '#525252',
      addedGutterColor: '#4ade80',
      removedGutterColor: '#f87171',
      codeFoldContentColor: '#737373',
      diffViewerTitleBackground: '#111111',
      diffViewerTitleColor: '#a3a3a3',
      diffViewerTitleBorderColor: '#262626',
    },
  },
};

export function ResumeDiff({ original, modified, onModifiedChange }: Props) {
  const [splitView, setSplitView] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(modified);

  function handleSaveEdit() {
    onModifiedChange(editContent);
    setEditing(false);
  }

  function handleCancelEdit() {
    setEditContent(modified);
    setEditing(false);
  }

  // Count changes
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const additions = modifiedLines.filter((l, i) => l !== originalLines[i]).length;
  const removals = originalLines.filter((l, i) => l !== modifiedLines[i]).length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">+{additions} additions</span>
          <span className="text-red-400">-{removals} removals</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSplitView(!splitView)}
            className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            {splitView ? 'Inline' : 'Split'}
          </button>
          {!editing ? (
            <button
              onClick={() => { setEditContent(modified); setEditing(true); }}
              className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleCancelEdit}
                className="text-xs px-2 py-1 rounded text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-500 transition-colors"
              >
                Apply
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full p-4 bg-[#0a0a0a] text-gray-200 text-sm font-mono resize-none focus:outline-none"
          />
        ) : (
          <ReactDiffViewer
            oldValue={original}
            newValue={modified}
            splitView={splitView}
            useDarkTheme={true}
            compareMethod={DiffMethod.WORDS}
            styles={darkTheme}
            leftTitle="Original"
            rightTitle="Tailored"
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/resume-diff.tsx package.json pnpm-lock.yaml
git commit -m "feat: replace Monaco diff with react-diff-viewer-continued"
```

## Chunk 5: Pricing Page + Token Balance UI

### Task 10: Pricing Page

**Files:**
- Create: `src/app/pricing/page.tsx`
- Create: `src/components/pricing-cards.tsx`

- [ ] **Step 1: Create pricing page (server component)**

Create `src/app/pricing/page.tsx`:

```tsx
import { getTokenBalance } from '@/lib/actions/token-actions';
import { PricingCards } from '@/components/pricing-cards';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const balance = await getTokenBalance();
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Get Tokens</h1>
        <p className="text-gray-400 mt-2">
          Each token lets you tailor one resume or generate one cover letter.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 border border-gray-700">
          <span className="text-green-400 font-bold text-lg">{balance}</span>
          <span className="text-sm text-gray-400">tokens remaining</span>
        </div>
      </div>
      <PricingCards />
      {/* FAQ */}
      <div className="mt-16 space-y-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-center">FAQ</h2>
        {[
          { q: 'What can I do with tokens?', a: 'Each token lets you tailor a resume to a job description (1 token) or generate a cover letter (1 token). Editing, stash, and job tracking are always free.' },
          { q: 'Do tokens expire?', a: 'No. Tokens never expire — use them whenever you need them.' },
          { q: 'Can I get a refund?', a: 'Yes. Contact us within 14 days of purchase for a full refund.' },
        ].map(faq => (
          <div key={faq.q} className="border border-gray-800 rounded-xl p-5">
            <h3 className="font-medium text-white text-sm">{faq.q}</h3>
            <p className="text-sm text-gray-400 mt-1">{faq.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create pricing cards (client component)**

Create `src/components/pricing-cards.tsx` with the 3 packs, buy buttons that POST to `/api/checkout` and redirect to checkout_url. Include success state from `?success=true` URL param.

- [ ] **Step 3: Build and verify**

Run: `pnpm build`
Expected: `/pricing` route appears

- [ ] **Step 4: Commit**

```bash
git add src/app/pricing/page.tsx src/components/pricing-cards.tsx
git commit -m "feat: add pricing page with token pack cards"
```

### Task 11: Token Balance in Nav Bar

**Files:**
- Create: `src/components/token-balance.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create token balance component**

Create `src/components/token-balance.tsx` — client component that fetches balance via server action and displays as pill in nav.

- [ ] **Step 2: Add to layout nav**

In `src/app/layout.tsx`, add `<TokenBalance />` next to `<UserMenu />` inside the nav.

- [ ] **Step 3: Add "Pricing" link to nav**

Add Pricing to the NAV_LINKS array in layout.tsx.

- [ ] **Step 4: Build check**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git add src/components/token-balance.tsx src/app/layout.tsx
git commit -m "feat: show token balance in nav bar with buy-more link"
```

### Task 12: Token Gate UI in Tailor Flow

**Files:**
- Modify: `src/components/tailor-flow.tsx`

- [ ] **Step 1: Add balance display and insufficient-tokens handling**

In `tailor-flow.tsx`:
- Fetch token balance on mount via `getTokenBalance()` server action
- Display "This will use 1 token (X remaining)" before generate button
- If balance is 0, show "No tokens remaining" with link to /pricing instead of generate button
- On `insufficient_tokens` error from server, show pricing modal

- [ ] **Step 2: Style the tailor page for dark theme**

Update the tailor-flow.tsx classes from `dark:bg-gray-900` / `dark:text-gray-300` patterns to dark-first (no `dark:` prefix since we're always dark).

- [ ] **Step 3: Build check**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/components/tailor-flow.tsx
git commit -m "feat: add token balance display and gate to tailor flow"
```

## Chunk 6: Landing Page Diff Hero + Settings Simplification

### Task 13: Landing Page Hero Redesign

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace mock preview with animated diff visualization**

In the hero section of `src/app/page.tsx`, replace the skeleton mockup with:
- Left panel: real-looking resume bullet points in muted text
- Right panel: same text with word-level green highlights that animate in using CSS `@keyframes` and staggered `animation-delay`
- "+N improvements" badge with count-up animation
- All pure CSS, no JS runtime

- [ ] **Step 2: Add "See Every Change" showcase section**

Between features and how-it-works, add a new section:
- Headline: "See every change. Keep what you like."
- Subtext about transparency vs black-box tools
- Larger mock diff with realistic resume content, line numbers, green highlights
- Split/Inline toggle mockup (non-functional, just visual)

- [ ] **Step 3: Add pricing CTA**

Update the CTA section to mention token pricing: "3 free tokens to start. No credit card required."

- [ ] **Step 4: Build check**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign landing page hero with animated diff showcase"
```

### Task 14: Simplify Settings Page

**Files:**
- Modify: `src/components/settings-form.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Simplify to model-only settings**

Since we're using Gemini natively, remove base URL and API key fields. Keep only:
- Model selector (default: gemini-2.5-pro)
- Optional: BYOK API key for users who want to use their own key

- [ ] **Step 2: Build check**

Run: `pnpm build`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings-form.tsx src/app/settings/page.tsx
git commit -m "feat: simplify settings for Gemini Pro (model selector + optional BYOK)"
```

## Chunk 7: Final Integration & Cleanup

### Task 15: Update .env.example and agents.md

**Files:**
- Modify: `.env.example`
- Modify: `agents.md`

- [ ] **Step 1: Update .env.example with all new vars**

Replace AI section, add Dodo section, add Gemini section.

- [ ] **Step 2: Update agents.md**

Add token system, Dodo Payments, Gemini Pro, and diff viewer to the architecture section.

- [ ] **Step 3: Commit**

```bash
git add .env.example agents.md
git commit -m "docs: update env example and agents.md for token system"
```

### Task 16: Full Build + Test + Lint

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All pass

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: All routes present including /pricing

- [ ] **Step 4: Push**

```bash
git push
```
