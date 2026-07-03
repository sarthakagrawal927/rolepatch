import { describe, expect, it } from 'vitest';

import {
  buildWeeklyDigest,
  buildWeeklyDigests,
  DIGEST_MAX_ITEMS,
  type DigestAlertRow,
  type DigestUser,
} from '@/lib/weekly-digest';

const DASHBOARD = 'https://rolepatch.com/dashboard';

const user: DigestUser = { id: 'u1', email: 'sam@example.com', name: 'Sam Carter' };

function alert(overrides: Partial<DigestAlertRow> = {}): DigestAlertRow {
  return {
    user_id: 'u1',
    title: 'Staff Engineer',
    detail: 'Acme · Remote',
    created_at: 1_700_000_000,
    ...overrides,
  };
}

describe('buildWeeklyDigest', () => {
  it('returns null when there are no alerts', () => {
    expect(buildWeeklyDigest(user, [], DASHBOARD)).toBeNull();
  });

  it('returns null when the user has no email', () => {
    expect(buildWeeklyDigest({ ...user, email: '  ' }, [alert()], DASHBOARD)).toBeNull();
  });

  it('uses singular subject for one match and plural otherwise', () => {
    expect(buildWeeklyDigest(user, [alert()], DASHBOARD)?.subject).toBe(
      '1 new job match this week — RolePatch'
    );
    expect(buildWeeklyDigest(user, [alert(), alert()], DASHBOARD)?.subject).toBe(
      '2 new job matches this week — RolePatch'
    );
  });

  it('includes match details and the dashboard CTA in html and text', () => {
    const digest = buildWeeklyDigest(user, [alert()], DASHBOARD);
    expect(digest?.to).toBe('sam@example.com');
    expect(digest?.html).toContain('Staff Engineer');
    expect(digest?.html).toContain('Acme · Remote');
    expect(digest?.html).toContain(`href="${DASHBOARD}"`);
    expect(digest?.html).toContain('Hi Sam,');
    expect(digest?.text).toContain('- Staff Engineer (Acme · Remote)');
    expect(digest?.text).toContain(DASHBOARD);
  });

  it('escapes HTML in job titles and details', () => {
    const digest = buildWeeklyDigest(
      user,
      [alert({ title: '<script>alert(1)</script>', detail: 'A & B' })],
      DASHBOARD
    );
    expect(digest?.html).not.toContain('<script>');
    expect(digest?.html).toContain('&lt;script&gt;');
    expect(digest?.html).toContain('A &amp; B');
  });

  it('caps listed items and reports the overflow count', () => {
    const alerts = Array.from({ length: DIGEST_MAX_ITEMS + 3 }, (_, i) =>
      alert({ title: `Role ${i}` })
    );
    const digest = buildWeeklyDigest(user, alerts, DASHBOARD);
    expect(digest?.subject).toContain(`${DIGEST_MAX_ITEMS + 3} new job matches`);
    expect(digest?.html).toContain(`Role ${DIGEST_MAX_ITEMS - 1}`);
    expect(digest?.html).not.toContain(`Role ${DIGEST_MAX_ITEMS}<`);
    expect(digest?.html).toContain('and 3 more');
    expect(digest?.text).toContain('and 3 more');
  });
});

describe('buildWeeklyDigests', () => {
  it('groups alerts per user and skips users without fresh matches', () => {
    const users: DigestUser[] = [
      user,
      { id: 'u2', email: 'kim@example.com', name: 'Kim' },
      { id: 'u3', email: 'lee@example.com', name: 'Lee' },
    ];
    const alerts = [
      alert({ user_id: 'u1', title: 'Role A' }),
      alert({ user_id: 'u2', title: 'Role B' }),
      alert({ user_id: 'u2', title: 'Role C' }),
    ];
    const digests = buildWeeklyDigests(users, alerts, DASHBOARD);
    expect(digests).toHaveLength(2);
    expect(digests.map((d) => d.userId)).toEqual(['u1', 'u2']);
    expect(digests[1].subject).toContain('2 new job matches');
  });

  it('ignores alerts for users not in the recipient list (e.g. opted out)', () => {
    const digests = buildWeeklyDigests([], [alert()], DASHBOARD);
    expect(digests).toHaveLength(0);
  });
});
