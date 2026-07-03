# RolePatch Chrome Extension

Manifest V3 Chrome extension. Adds a toolbar popup that can scrape a job page,
save it to the RolePatch queue, send it to RolePatch for tailoring, fill visible
ATS application fields from a prepared RolePatch packet, click submit after
explicit review, and capture submission receipts.

## Build

```bash
corepack pnpm install
corepack pnpm --filter @rolepatch/extension build
```

Output lands in `extension/dist/` (manifest, bundled JS, popup, icons).

## Dev (watch mode)

```bash
corepack pnpm --filter @rolepatch/extension dev
```

## Load unpacked in Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top right)
3. Click **Load unpacked**
4. Select `extension/dist/`

The RolePatch icon appears in the toolbar. Click it on any job page and use:

- **Save to RolePatch queue** to scrape the job, create or reuse the tracked
  application, and queue it in the review-first apply-agent command center.
- **Tailor with RolePatch** to scrape the job and open the tailoring flow.
- **Fill application fields** to fetch the tracked job packet and fill matching
  empty fields from saved profile answers/materials. Optional resume/CV and
  cover-letter file pickers let you attach user-selected files to matching file
  inputs during the same reviewed fill step. Tracked jobs are matched against
  the current URL and a no-query/no-hash canonical URL so ATS tracking params do
  not break packet lookup.
- **Reviewed submit** to run a guarded final-submit click after you review the
  page. It blocks on CAPTCHA/human verification, unfilled required fields,
  outstanding file uploads, and missing submit buttons. Confirmed submissions
  create `submitted` receipts with a final visible field snapshot and learn
  reusable profile answers from submitted ATS answers; ambiguous submit attempts
  create `failed` receipts for review.
- **Capture submitted receipt** after you manually submit and land on the ATS
  confirmation page. The capture also stores the final visible application
  fields when the ATS page is still available.

## API base

The popup has an **API base** field (bottom). Defaults to
`http://localhost:3000`. Change it to the prod URL (e.g.
`https://rolepatch.com`) when using against production.

## Auth

The service worker reads your RolePatch better-auth session cookie
(`better-auth.session_token` or its secure deployment variant) via
`chrome.cookies.get` and forwards it both as a normal cookie (via
`credentials: 'include'`) and via an `x-rolepatch-session` header for cases
where cross-origin cookie propagation is blocked. You must be signed in to
RolePatch in the same browser profile.

## Apply-agent boundary

Fill and reviewed-submit modes are explicit user-triggered automation. The
extension fills fields only after a user click, records exact filled
labels/answers/files, snapshots final visible answers at submit/capture time,
learns sensitive profile answers from successful submitted receipts, detects
submit buttons and file upload fields, blocks
reviewed submit when CAPTCHA/manual upload/required-field risks remain, and
records failed receipts when an ATS confirmation is not detected. File upload
assistance only uses files the user explicitly picked in the popup. It does not
bypass captchas or run unattended bulk apply.

## How scraping/fill works

`src/content.ts` tries site-specific selectors first for Greenhouse, Lever,
LinkedIn, Workday, Ashby, Workable, Recruitee, and Personio. If none match, it
falls back to `document.body.innerText`.
Works on any page via `activeTab` + on-demand injection — no permanent
content scripts registered.

For filling, the content script uses provider-aware label context for
Greenhouse, Lever, Workday, Ashby, Workable, Recruitee, Personio, and generic
forms, then matches visible empty inputs/selects/radio/checkboxes against saved
RolePatch profile answers.

## Files

```
extension/
├── manifest.json           # MV3 manifest (copied to dist/)
├── src/
│   ├── background.ts       # Service worker: POSTs to RolePatch
│   ├── content.ts          # Scrapes JD, fills fields, and runs reviewed submit
│   ├── popup.html          # Toolbar popup UI
│   ├── popup.ts            # Popup logic
│   ├── config.ts           # API base storage
│   └── types.ts            # Shared message types
├── icons/                  # 16/48/128 PNG placeholders
├── scripts/
│   └── copy-static.mjs     # Copies manifest/popup/icons into dist/
└── tsconfig.json
```
