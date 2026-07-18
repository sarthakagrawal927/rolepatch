---
title: Failed approaches
---

# Failed approaches

What we tried and abandoned, and why. Record the dead end so the next
agent doesn't retry it.

## Python JobSpy multi-board job-search sidecar

**Tried:** A Python sidecar (`api/python/`) wrapping
[python-jobspy](https://github.com/speedyapply/JobSpy) for multi-board
job search (LinkedIn, Indeed, Glassdoor, ZipRecruiter, etc.).

**Why abandoned:** Cloudflare Workers has no Python runtime. The
sidecar could not run on the same deploy, and running it on a separate
Node/Python host added a second deploy target for a feature that is
not the product's core.

**Replaced by:** Native in-Worker LinkedIn search
(`src/lib/job-search.ts`). See
[ADR-0005](../architecture/decisions/0005-linkedin-only-job-search.md).

## Native Gemini SDK for AI

**Tried:** The 2026-03-16 token-system spec proposed replacing the
OpenAI adapter with `@ai-sdk/google` and native Gemini.

**Why abandoned:** A native SDK locks the app to one vendor. The
single OpenAI-compatible adapter (`src/lib/ai.ts`) is swappable across
the free-ai-gateway, local AI, and BYOK via `baseURL` swap — that
flexibility is more valuable than native Gemini features.

**Replaced by:** The adapter pattern. See
[ADR-0001](../architecture/decisions/0001-cloudflare-workers-opennext.md).

## Puppeteer-core + @sparticuz/chromium for PDF export

**Tried:** Running puppeteer-core with @sparticuz/chromium for
server-side PDF rendering.

**Why abandoned:** The puppeteer-core + @sparticuz/chromium path was
broken on Cloudflare Workers. Replaced by the Cloudflare Workers
Browser Rendering binding (`BROWSER` in `wrangler.toml`), used by
`src/lib/pdf.ts` `renderPdf()`.

## Monaco editor for the diff view

**Tried:** Monaco (VS Code's editor, 2MB+) for the side-by-side resume
diff view.

**Why abandoned:** Monaco is a full code editor — overkill for a
read-only markdown diff. 2MB+ on the LCP path for a review surface.

**Replaced by:** `react-diff-viewer-continued` (~50KB, purpose-built
for diffs, word-level highlighting). CodeMirror 6 is still used for
the editable resume editor (separate from the diff view). See
[learnings](learnings/new-things.md) for the two-editor split.

## Hand-written JSON-LD

**Tried:** Hand-writing JSON-LD structured data on marketing pages.

**Why abandoned:** Drifted from schema.org spec over time; fleet
generator produces a marked block that stays in sync.

**Replaced by:** Fleet-generated marked JSON-LD block (commit
`7bd897b`). See `agent-edge.mjs` and the marketing page generators.

## Unauthenticated writes to D1 (guest leak)

**Tried:** Letting guest server actions write to D1 with
`user_id = NULL` so guests had a server-side persistence path.

**Why abandoned:** Created orphan rows accessible to all guests. Any
user who guessed or knew a `jobId` could read another guest's data.

**Replaced by:** Guest writes go through `localStorage` only; server
actions throw if `userId` is null on a write path. See
[the security audit](security-audit.md) and
[ADR-0002](../architecture/decisions/0002-guest-localstorage-parity.md).

## Payment insert + token credit as separate operations

**Tried:** Recording the Dodo payment and crediting tokens as two
separate DB operations.

**Why abandoned:** If `creditTokens` failed, the payment was recorded
but tokens were never granted — and the idempotency check prevented
retry. Users paid and got nothing.

**Replaced by:** Single D1 transaction wrapping payment insert + token
credit. See [the security audit](security-audit.md) → High.

## Client-side payment verification via `?success=true`

**Tried:** Showing a "Payment successful!" banner based solely on the
`?success=true` query param after Dodo checkout redirect.

**Why abandoned:** Anyone could append `?success=true` to see the
banner without paying.

**Replaced by:** Server-side verification that a recent payment exists
for the user before showing success. See
[the security audit](security-audit.md) → High.
