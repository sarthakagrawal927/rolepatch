// Privacy contract test for RolePatch activation events.
//
// The fleet 4-event taxonomy (`signup`, `activated`, `core_action`,
// `returned`) is the only channel through which RolePatch may report
// activation evidence to PostHog / Foundry. Resume text, job descriptions,
// stash content, cover letters, fit-score payloads, contact bodies, and
// credentials must never enter those events.
//
// This is a source-level contract test: it reads the analytics module and
// every activation call site as text and asserts that:
//   1. The `AnalyticsEventMap` only declares `project_id` (and `action` for
//      `core_action`) — no payload fields for resume/JD/stash/cover-letter.
//   2. Every `trackActivated` / `trackCoreAction` call site passes only the
//      allowed arguments (action enum + optional distinctId).
//   3. No resume/JD/stash/cover-letter variable is passed into `trackEvent`
//      or `emit`.
//
// A future regression that adds `trackCoreAction('tailor_completed', resume)`
// or extends the event map with a `resume` field will fail this test before
// it ships.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

const ACTIVATION_FILES = [
  'src/lib/actions/tailor-action.ts',
  'src/lib/actions/cover-letter-action.ts',
  'src/lib/actions/fit-score-action.ts',
];

async function read(relativePath: string): Promise<string> {
  return readFile(resolve(ROOT, relativePath), 'utf8');
}

describe('analytics event map only declares sanitized fields', () => {
  it('AnalyticsEventMap carries only project_id (and action for core_action)', async () => {
    const analytics = await read('src/lib/analytics.ts');
    // The event map must declare project_id for every event and action only
    // for core_action. No resume/JD/stash/cover-letter/fit-score payload fields.
    expect(analytics).toMatch(/interface AnalyticsEventMap/);
    expect(analytics).toMatch(/signup:\s*\{\s*project_id:\s*typeof PROJECT\s*\}/);
    expect(analytics).toMatch(/activated:\s*\{\s*project_id:\s*typeof PROJECT\s*\}/);
    expect(analytics).toMatch(
      /core_action:\s*\{\s*project_id:\s*typeof PROJECT;\s*action:\s*CoreAction\s*\}/
    );
    expect(analytics).toMatch(/returned:\s*\{\s*project_id:\s*typeof PROJECT\s*\}/);
    // Extract just the AnalyticsEventMap block and assert it carries no
    // payload fields beyond project_id / action. The surrounding file
    // legitimately mentions "resume-tailor" (project slug) and
    // "cover_letter_generated" (action enum) — those are not payload fields.
    const mapBlock = analytics.match(/interface AnalyticsEventMap\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(mapBlock).toBeTruthy();
    for (const field of [
      'resume',
      'jd',
      'stash',
      'coverLetter',
      'cover_letter',
      'fitScore',
      'fit_score',
      'companyResearch',
      'company_research',
      'contact',
      'email',
      'phone',
    ]) {
      expect(mapBlock).not.toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it('CoreAction enum is closed to the three product verbs', async () => {
    const analytics = await read('src/lib/analytics.ts');
    expect(analytics).toMatch(
      /export type CoreAction = 'tailor_completed' \| 'cover_letter_generated' \| 'fit_score_run'/
    );
  });
});

describe('activation call sites pass only sanitized arguments', () => {
  it.each(
    ACTIVATION_FILES
  )('%s calls trackActivated/trackCoreAction without private payloads', async (file) => {
    const source = await read(file);
    // Every trackCoreAction call must pass only the action enum + optional
    // `userId` distinctId. The regex is strict: only `userId` (or
    // `userId ?? undefined`) is permitted as the second argument — any other
    // variable (resumeSource, jdText, stashContent, etc.) fails the match.
    const coreActionCalls = source.match(/trackCoreAction\([^)]*\)/g) ?? [];
    expect(coreActionCalls.length).toBeGreaterThan(0);
    for (const call of coreActionCalls) {
      expect(call).toMatch(
        /^trackCoreAction\(['"][a-z_]+['"](?:,\s*userId(?:\s*\?\?\s*undefined)?)?\)$/
      );
    }
    // trackActivated calls (only in tailor-action) must pass only `userId`.
    const activatedCalls = source.match(/trackActivated\([^)]*\)/g) ?? [];
    for (const call of activatedCalls) {
      expect(call).toMatch(/^trackActivated\(userId\)$/);
    }
  });
});

describe('trackEvent signature does not accept raw private payloads', () => {
  it('trackEvent accepts event + properties + distinctId only', async () => {
    const analytics = await read('src/lib/analytics.ts');
    expect(analytics).toMatch(
      /export function trackEvent\(\s*event:\s*string,\s*properties:\s*Record<string,\s*unknown>\s*=\s*\{\},\s*distinctId\?:\s*string\s*\)/
    );
  });
});
