import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as BrowserCheckRoute from '@/app/api/apply-agent/browser-check/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockRunReviewedApplyBrowserCheckForUser = vi.fn();
const mockRunReviewedApplyBrowserCheckBatchForUser = vi.fn();
vi.mock('@/lib/apply-agent-browser-run', () => ({
  runReviewedApplyBrowserCheckForUser: (...args: unknown[]) =>
    mockRunReviewedApplyBrowserCheckForUser(...args),
  runReviewedApplyBrowserCheckBatchForUser: (...args: unknown[]) =>
    mockRunReviewedApplyBrowserCheckBatchForUser(...args),
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/apply-agent/browser-check', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<(typeof BrowserCheckRoute)['POST']>[0];
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockRunReviewedApplyBrowserCheckForUser.mockReset();
  mockRunReviewedApplyBrowserCheckBatchForUser.mockReset();
  vi.resetModules();
});

describe('POST /api/apply-agent/browser-check', () => {
  it('rejects signed-out requests', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/apply-agent/browser-check/route');
    const res = await POST(makeReq({ queue_id: 'queue-1' }));
    expect(res.status).toBe(401);
    expect(mockRunReviewedApplyBrowserCheckForUser).not.toHaveBeenCalled();
  });

  it('runs reviewed browser check for the authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockRunReviewedApplyBrowserCheckForUser.mockResolvedValue({
      queue_id: 'queue-1',
      job_id: 'job-1',
      url: 'https://jobs.lever.co/acme/1',
      provider: 'lever',
      runtime: 'fetch_fallback',
      supported_provider: true,
      forms_detected: 1,
      fields_detected: 5,
      submit_detected: true,
      upload_fields: [],
      captcha_detected: false,
      status: 'ready_to_submit',
      summary: 'Reviewed browser check found an application form ready for user-controlled submit.',
      failure_reason: null,
      receipt_id: 'receipt-1',
    });

    const { POST } = await import('@/app/api/apply-agent/browser-check/route');
    const res = await POST(makeReq({ queue_id: 'queue-1' }));

    expect(res.status).toBe(200);
    expect(mockRunReviewedApplyBrowserCheckForUser).toHaveBeenCalledWith('user-1', 'queue-1');
    expect((await res.json()).result.status).toBe('ready_to_submit');
  });

  it('runs reviewed browser checks in a batch', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockRunReviewedApplyBrowserCheckBatchForUser.mockResolvedValue({
      requested: 2,
      processed: 1,
      results: [{ queue_id: 'queue-1', status: 'ready_to_submit' }],
      errors: [{ queue_id: 'queue-2', error: 'Queued application not found' }],
    });

    const { POST } = await import('@/app/api/apply-agent/browser-check/route');
    const res = await POST(makeReq({ queue_ids: ['queue-1', 'queue-2'], limit: 2 }));

    expect(res.status).toBe(200);
    expect(mockRunReviewedApplyBrowserCheckBatchForUser).toHaveBeenCalledWith('user-1', {
      queueIds: ['queue-1', 'queue-2'],
      limit: 2,
    });
    expect((await res.json()).batch.errors).toHaveLength(1);
  });

  it('rejects non-object request bodies before running browser checks', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');

    const { POST } = await import('@/app/api/apply-agent/browser-check/route');
    const res = await POST(makeReq(null));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Request body must be an object' });
    expect(mockRunReviewedApplyBrowserCheckForUser).not.toHaveBeenCalled();
    expect(mockRunReviewedApplyBrowserCheckBatchForUser).not.toHaveBeenCalled();
  });

  it('rejects invalid batch limits before running browser checks', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');

    const { POST } = await import('@/app/api/apply-agent/browser-check/route');
    const res = await POST(makeReq({ queue_ids: ['queue-1'], limit: '2' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'limit must be a positive integer' });
    expect(mockRunReviewedApplyBrowserCheckBatchForUser).not.toHaveBeenCalled();
  });
});
