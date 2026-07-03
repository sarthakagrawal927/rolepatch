import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as BrowserSubmitRoute from '@/app/api/apply-agent/browser-submit/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockRunGuardedApplyBrowserSubmitForUser = vi.fn();
const mockRunGuardedApplyBrowserSubmitBatchForUser = vi.fn();
vi.mock('@/lib/apply-agent-browser-run', () => ({
  runGuardedApplyBrowserSubmitForUser: (...args: unknown[]) =>
    mockRunGuardedApplyBrowserSubmitForUser(...args),
  runGuardedApplyBrowserSubmitBatchForUser: (...args: unknown[]) =>
    mockRunGuardedApplyBrowserSubmitBatchForUser(...args),
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/apply-agent/browser-submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<(typeof BrowserSubmitRoute)['POST']>[0];
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockRunGuardedApplyBrowserSubmitForUser.mockReset();
  mockRunGuardedApplyBrowserSubmitBatchForUser.mockReset();
  vi.resetModules();
});

describe('POST /api/apply-agent/browser-submit', () => {
  it('rejects signed-out requests', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/apply-agent/browser-submit/route');
    const res = await POST(makeReq({ queue_id: 'queue-1' }));
    expect(res.status).toBe(401);
    expect(mockRunGuardedApplyBrowserSubmitForUser).not.toHaveBeenCalled();
  });

  it('runs guarded submit for the authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockRunGuardedApplyBrowserSubmitForUser.mockResolvedValue({
      queue_id: 'queue-1',
      job_id: 'job-1',
      url: 'https://jobs.lever.co/acme/1',
      provider: 'lever',
      runtime: 'cloudflare_browser',
      status: 'submitted',
      summary: 'Guarded submit completed and detected an ATS confirmation.',
      failure_reason: null,
      submit_clicked: true,
      confirmation_url: 'https://jobs.lever.co/acme/1/thanks',
      filled_fields: 4,
      blocked_reasons: [],
      receipt_id: 'receipt-1',
    });

    const { POST } = await import('@/app/api/apply-agent/browser-submit/route');
    const res = await POST(makeReq({ queue_id: 'queue-1' }));

    expect(res.status).toBe(200);
    expect(mockRunGuardedApplyBrowserSubmitForUser).toHaveBeenCalledWith('user-1', 'queue-1');
    expect((await res.json()).result.status).toBe('submitted');
  });

  it('runs guarded submit in a batch', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockRunGuardedApplyBrowserSubmitBatchForUser.mockResolvedValue({
      requested: 2,
      processed: 1,
      results: [{ queue_id: 'queue-1', status: 'submitted' }],
      errors: [
        { queue_id: 'queue-2', error: 'Queued application is not ready for guarded submit' },
      ],
    });

    const { POST } = await import('@/app/api/apply-agent/browser-submit/route');
    const res = await POST(makeReq({ queue_ids: ['queue-1', 'queue-2'], limit: 2 }));

    expect(res.status).toBe(200);
    expect(mockRunGuardedApplyBrowserSubmitBatchForUser).toHaveBeenCalledWith('user-1', {
      queueIds: ['queue-1', 'queue-2'],
      limit: 2,
    });
    expect((await res.json()).batch.errors).toHaveLength(1);
  });
});
