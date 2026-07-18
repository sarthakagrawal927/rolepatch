# Auth & Multi-User Design

## Problem
App is currently single-user with no auth. Need Google OAuth for multi-user with per-user data isolation, while keeping the full experience available to guests via localStorage.

## NextAuth Setup
- next-auth v5 (Auth.js) with Google OAuth, JWT sessions
- New `users` table: `id`, `email`, `name`, `image`, `created_at`

## Data Isolation
- Add `user_id TEXT` column to all existing tables
- All DB queries filter by `user_id` from session

## Guest Experience (localStorage)
- Full app works without sign-in
- Guest data stored in localStorage (resumes, stash entries, tailored versions)
- Only DB write: `job_applications` with `user_id = NULL` + UNIQUE on cleaned URL
- No server actions called except scrapeJobUrl and createJobApplication

## Signed-In Experience (DB)
- Everything persists to Turso with user_id
- Same UI, backed by DB instead of localStorage

## UI Changes
- Sign in / avatar in nav bar
- No gates or redirects — app always works
- Subtle "Sign in to sync across devices" nudge

## Vercel Deployment
- Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, existing Turso + AI vars

## Out of Scope
- Migrating localStorage to DB on sign-in
- Rate limiting, admin panel, multi-provider
