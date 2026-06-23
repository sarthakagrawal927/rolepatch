import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as JobsSearchRoute from '@/app/api/jobs/search/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockSearchJobs = vi.fn();
vi.mock('@/lib/job-search', () => ({
  searchJobs: (...args: unknown[]) => mockSearchJobs(...args),
}));

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockSearchJobs.mockReset();
  vi.resetModules();
});

function makeReq(body: unknown, origin = 'http://localhost') {
  return new Request(`${origin}/api/jobs/search`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as Parameters<(typeof JobsSearchRoute)['POST']>[0];
}

describe('POST /api/jobs/search', () => {
  it('rejects unauthenticated requests with 401', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(401);
    expect(mockSearchJobs).not.toHaveBeenCalled();
  });

  it('returns 400 when query is missing', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-config');
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(mockSearchJobs).not.toHaveBeenCalled();
  });

  it('returns jobs from the native in-Worker search', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-forward');
    mockSearchJobs.mockResolvedValue({ jobs: [{ id: 'abc', title: 'Dev' }] });

    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python engineer', location: 'Remote' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.jobs).toHaveLength(1);
    expect(mockSearchJobs).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'python engineer', location: 'Remote' })
    );
  });

  it('maps search failures to 502', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-5xx');
    mockSearchJobs.mockRejectedValue(new Error('boom'));
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(502);
  });

  it('allows repeated job searches for the same user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-burst');
    mockSearchJobs.mockResolvedValue({ jobs: [] });

    const { POST } = await import('@/app/api/jobs/search/route');
    for (let i = 0; i < 8; i++) {
      const ok = await POST(makeReq({ query: 'python' }));
      expect(ok.status).toBe(200);
    }
  });
});
