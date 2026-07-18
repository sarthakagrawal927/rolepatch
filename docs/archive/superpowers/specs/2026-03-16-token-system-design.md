# Token System, Gemini Pro, Diff Upgrade & Landing Page — Design Spec

Date: 2026-03-16

## Overview

Add token-based monetization with Dodo Payments, switch AI to Gemini Pro, upgrade the diff view from Monaco to react-diff-viewer-continued, and redesign the landing page hero to showcase the diff feature.

## 1. Token System

### Database Schema

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

### Token Packs

| Product | Tokens | Price | Per-token |
|---------|--------|-------|-----------|
| Signup bonus | 3 | Free | — |
| Starter | 10 | $5 | $0.50 |
| Pro | 30 | $12 | $0.40 |
| Bulk | 100 | $30 | $0.30 |

Starter/Pro/Bulk are created as one-time products in Dodo dashboard. Product IDs stored in env vars.

### Token Costs

| Action | Cost |
|--------|------|
| Tailor resume | 1 token |
| Generate cover letter | 1 token |
| Re-tailor same job | 1 token |
| Everything else | Free |

### Security

- **Server-side only** — balance stored in DB, never trusted from client
- **Atomic debit** — `UPDATE token_balances SET balance = balance - 1, total_used = total_used + 1 WHERE user_id = ? AND balance >= 1 RETURNING balance` — single statement, no race conditions
- **Transaction ledger** — every change recorded with balance_after snapshot
- **Webhook verification** — Dodo webhooks verified via `standardwebhooks` HMAC
- **Idempotent credits** — payments table uses Dodo payment_id as PK, INSERT OR IGNORE prevents double-credit
- **AI failure refund** — if Gemini call throws, token is credited back in catch block
- **Refund handling** — webhook handler for payment.refunded deducts tokens (floors at 0)
- **Guest tokens** — guests get 3 tokens via anonymous session stored server-side (not localStorage). Tokens transfer on sign-in migration.

### Server Actions

**`src/lib/actions/token-actions.ts`:**
- `getTokenBalance()` — returns current balance for user
- `debitToken(type, referenceId)` — atomic debit + transaction log, returns { success, balance } or { success: false, error: 'insufficient' }
- `creditTokens(amount, type, referenceId)` — credit tokens + transaction log
- `initializeBalance(userId)` — called on first sign-in, gives 3 free tokens

### Purchase Flow

1. User clicks pack on `/pricing` → POST to `/api/checkout` with `{ productId, quantity: 1 }`
2. Route handler creates Dodo checkout session with user email
3. Returns `{ checkout_url }` → redirect user
4. User pays on Dodo hosted checkout
5. Dodo sends webhook to `/api/webhook/dodo-payments`
6. `onPaymentSucceeded` → verify, credit tokens, record payment
7. User returns to `/pricing?success=true`

### API Routes

**`src/app/api/checkout/route.ts`:** POST handler, creates Dodo checkout session
**`src/app/api/webhook/dodo-payments/route.ts`:** Webhook handler, credits tokens on payment success

## 2. Gemini Pro AI Provider

### Changes

Replace `@ai-sdk/openai` with `@ai-sdk/google` in `src/lib/ai.ts`:

```ts
import { google } from '@ai-sdk/google';

export function getAIProvider(config?: Partial<AIProviderConfig>) {
  const model = config?.model || process.env.AI_MODEL || 'gemini-2.5-pro';
  return { provider: google, model };
}
```

### Environment Variables

```
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
AI_MODEL=gemini-2.5-pro
```

Remove `AI_BASE_URL` and `AI_API_KEY` (no longer needed with native Gemini provider). Keep settings page for model override only.

### Migration

- `tailor-action.ts` — wrap in token debit, use new provider
- `cover-letter-action.ts` — wrap in token debit, use new provider
- Settings page — simplify to just model selector (API key optional for BYOK)

## 3. Diff View Upgrade

### Replace Monaco with react-diff-viewer-continued

**Why:** Monaco is a 2MB+ code editor — overkill for markdown diff. react-diff-viewer-continued is ~50KB, purpose-built for diffs, with word-level highlighting.

### New Component: `src/components/resume-diff.tsx`

```
Props:
  original: string
  modified: string
  onModifiedChange: (value: string) => void

Features:
  - Side-by-side view (default)
  - Inline view toggle
  - Word-level diff highlighting
  - Dark theme matching app
  - Change stats: "X additions, Y removals"
  - Modified side is editable (contentEditable or textarea overlay)
```

### Dependencies

Remove: `@monaco-editor/react`
Add: `react-diff-viewer-continued`

### Editability

react-diff-viewer-continued is read-only by default. For editing the tailored side:
- Show diff view for review
- "Edit" button switches to a textarea/CodeMirror with the modified content
- User edits, then diff recalculates on blur/save

This is simpler and avoids hacking contentEditable into the diff viewer.

## 4. Landing Page — Diff Hero

### Hero Section Update

Replace the static skeleton mockup with an animated diff visualization:

**Left side:** Faded resume text (4-5 real-looking bullet points)
**Right side:** Same text with green-highlighted word-level changes that animate in with staggered delays
**Badge:** "+12 improvements" counter that animates up

All CSS-only animations (keyframes + animation-delay), no JS runtime.

### New Section: "See Every Change"

Between features and how-it-works, add a dedicated diff showcase:

> **"See every change. Keep what you like."**
>
> Unlike other tools that give you a black box, Resume Tailor shows exactly what changed — additions in green, modifications highlighted. Accept everything, or edit the changes yourself.

Show a larger, more detailed mock diff with:
- A realistic resume bullet point (original vs tailored)
- Word-level green highlights on the tailored side
- Line numbers
- Split/inline toggle mockup

## 5. Pricing Page

### New Route: `/pricing`

Simple page with:
- Current balance display
- Three pack cards (Starter, Pro, Bulk)
- Each card: token count, price, per-token cost, "Buy" button
- Buy button → POST to /api/checkout → redirect to Dodo
- Success state after return from checkout
- FAQ section: "What can I do with tokens?", "Do tokens expire?" (no), "Can I get a refund?"

## 6. UI Integration

### Nav Bar
- Show token balance pill next to user menu: `⚡ 3`
- Click opens dropdown with balance + "Buy more" link

### Tailor Page
- Before generation: "This will use 1 token. You have X remaining."
- If balance is 0: show pricing modal instead of generating
- After generation: "1 token used. X remaining."

### Cover Letter Page
- Same pattern as tailor page

## 7. Environment Variables (New)

```
# Dodo Payments
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_KEY=
DODO_PAYMENTS_RETURN_URL=https://yourdomain.com/pricing?success=true
DODO_PAYMENTS_ENVIRONMENT=test_mode

# Dodo Product IDs
DODO_PRODUCT_STARTER=
DODO_PRODUCT_PRO=
DODO_PRODUCT_BULK=

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY=
AI_MODEL=gemini-2.5-pro
```

## 8. Files Changed/Created

### New Files
- `src/lib/actions/token-actions.ts` — token balance CRUD + debit/credit
- `src/app/api/checkout/route.ts` — Dodo checkout session creator
- `src/app/api/webhook/dodo-payments/route.ts` — Dodo webhook handler
- `src/app/pricing/page.tsx` — pricing page (server component)
- `src/components/pricing-cards.tsx` — client component with buy buttons
- `src/components/token-balance.tsx` — nav bar balance display

### Modified Files
- `src/lib/ai.ts` — switch to Gemini provider
- `src/lib/db-schema.sql` — add 3 new tables
- `src/lib/db-migrate.ts` — add migration for new tables
- `src/lib/actions/tailor-action.ts` — add token debit + Gemini
- `src/lib/actions/cover-letter-action.ts` — add token debit + Gemini
- `src/components/resume-diff.tsx` — replace Monaco with react-diff-viewer-continued
- `src/components/tailor-flow.tsx` — add token balance check + display
- `src/app/layout.tsx` — add token balance to nav
- `src/app/page.tsx` — new hero diff animation + diff showcase section
- `src/app/settings/page.tsx` — simplify for Gemini
- `src/components/settings-form.tsx` — simplify (model only, optional API key)
- `.env.example` — add new env vars
- `package.json` — swap Monaco for react-diff-viewer-continued, add Dodo + Google deps
