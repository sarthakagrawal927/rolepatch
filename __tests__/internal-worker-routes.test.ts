import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  runCompanyWatchForUser: vi.fn(),
  isEmailConfigured: vi.fn(),
  sendEmail: vi.fn(),
  buildWeeklyDigests: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mocks.dbExecute(...args) },
}));

vi.mock('@/lib/actions/job-discovery-actions', () => ({
  runCompanyWatchForUser: (...args: unknown[]) => mocks.runCompanyWatchForUser(...args),
}));

vi.mock('@/lib/email', () => ({
  isEmailConfigured: () => mocks.isEmailConfigured(),
  sendEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}));

vi.mock('@/lib/weekly-digest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/weekly-digest')>();
  return {
    ...actual,
    buildWeeklyDigests: (...args: unknown[]) => mocks.buildWeeklyDigests(...args),
  };
});

function makeReq(path: string, internal = true) {
  return new Request(`https://rolepatch.com${path}`, {
    method: 'POST',
    headers: internal ? { 'x-rolepatch-internal': 'worker' } : {},
  });
}

beforeEach(() => {
  vi.resetModules();
  mocks.dbExecute.mockReset();
  mocks.runCompanyWatchForUser.mockReset();
  mocks.isEmailConfigured.mockReset();
  mocks.sendEmail.mockReset();
  mocks.buildWeeklyDigests.mockReset();
  mocks.dbExecute.mockResolvedValue({ rows: [] });
  mocks.isEmailConfigured.mockReturnValue(true);
  mocks.buildWeeklyDigests.mockReturnValue([]);
});

describe('internal Worker route guards', () => {
  it('rejects external company-watch cron requests before querying watches', async () => {
    const { POST } = await import('@/app/api/internal/cron/company-watchlist/route');
    const res = await POST(makeReq('/api/internal/cron/company-watchlist', false));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'Not found' });
    expect(mocks.dbExecute).not.toHaveBeenCalled();
    expect(mocks.runCompanyWatchForUser).not.toHaveBeenCalled();
  });

  it('runs company-watch cron for internal Worker requests', async () => {
    mocks.dbExecute.mockResolvedValue({
      rows: [
        {
          id: 'watch-1',
          user_id: 'user-1',
          company: 'Acme',
          career_url: 'https://acme.test/jobs',
          role_query: 'engineer',
          location: '',
          remote: 1,
          paused: 0,
          last_run_at: null,
          last_result_ids: '[]',
          last_source: null,
          last_found_count: null,
          last_error: null,
          created_at: 1,
          updated_at: 1,
        },
      ],
    });
    mocks.runCompanyWatchForUser.mockResolvedValue(2);

    const { POST } = await import('@/app/api/internal/cron/company-watchlist/route');
    const res = await POST(makeReq('/api/internal/cron/company-watchlist'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ watches: 1, alerts: 2, failed: 0 });
    expect(mocks.runCompanyWatchForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'watch-1', company: 'Acme' }),
      'user-1'
    );
  });

  it('rejects external weekly-digest cron requests before email or database work', async () => {
    const { POST } = await import('@/app/api/internal/cron/weekly-digest/route');
    const res = await POST(makeReq('/api/internal/cron/weekly-digest', false));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'Not found' });
    expect(mocks.isEmailConfigured).not.toHaveBeenCalled();
    expect(mocks.dbExecute).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('skips weekly digest internally when email is not configured', async () => {
    mocks.isEmailConfigured.mockReturnValue(false);

    const { POST } = await import('@/app/api/internal/cron/weekly-digest/route');
    const res = await POST(makeReq('/api/internal/cron/weekly-digest'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ skipped: true, reason: 'email-not-configured' });
    expect(mocks.dbExecute).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('passes weekly queue and receipt activity into digest assembly', async () => {
    mocks.dbExecute
      .mockResolvedValueOnce({
        rows: [{ id: 'u1', email: 'sam@example.com', name: 'Sam' }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', title: 'Staff Engineer', detail: 'Acme · Remote', created_at: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', status: 'ready_to_submit', updated_at: 1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u1', status: 'submitted', provider: 'greenhouse', created_at: 1 }],
      });
    mocks.buildWeeklyDigests.mockReturnValue([
      {
        userId: 'u1',
        to: 'sam@example.com',
        subject: 'Digest',
        html: '<p>Digest</p>',
        text: 'Digest',
      },
    ]);
    mocks.sendEmail.mockResolvedValue({ sent: true });

    const { POST } = await import('@/app/api/internal/cron/weekly-digest/route');
    const res = await POST(makeReq('/api/internal/cron/weekly-digest'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ candidates: 1, sent: 1, failed: 0 });
    expect(mocks.dbExecute).toHaveBeenCalledTimes(4);
    expect(mocks.buildWeeklyDigests).toHaveBeenCalledWith(
      [{ id: 'u1', email: 'sam@example.com', name: 'Sam' }],
      [{ user_id: 'u1', title: 'Staff Engineer', detail: 'Acme · Remote', created_at: 1 }],
      'https://rolepatch.com/dashboard',
      [{ user_id: 'u1', status: 'ready_to_submit', updated_at: 1 }],
      [{ user_id: 'u1', status: 'submitted', provider: 'greenhouse', created_at: 1 }]
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'sam@example.com' })
    );
  });
});
