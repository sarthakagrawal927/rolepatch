import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as JobsSearchRoute from '@/app/api/jobs/search/route';

const mockSearchJobs = vi.fn();
vi.mock('@/lib/job-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/job-search')>();
  return {
    ...actual,
    searchJobs: (...args: unknown[]) => mockSearchJobs(...args),
  };
});

beforeEach(() => {
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
  it('allows guest searches against the public job source', async () => {
    mockSearchJobs.mockResolvedValue({ jobs: [{ id: 'abc', title: 'Dev' }] });

    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobs: [{ id: 'abc', title: 'Dev' }] });
    expect(mockSearchJobs).toHaveBeenCalledWith(expect.objectContaining({ query: 'python' }));
  });

  it('returns 400 when query is missing', async () => {
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(mockSearchJobs).not.toHaveBeenCalled();
  });

  it('returns 400 for non-object request bodies before searching', async () => {
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq(null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Request body must be an object' });
    expect(mockSearchJobs).not.toHaveBeenCalled();
  });

  it('returns jobs from the native in-Worker search', async () => {
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
    mockSearchJobs.mockRejectedValue(new Error('boom'));
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/temporarily unavailable/i);
    expect(json.error).not.toContain('boom');
    expect(json.detail).toMatchObject({ reason: 'unavailable', retryable: true });
  });

  it('maps upstream rate limits to actionable retry copy', async () => {
    mockSearchJobs.mockRejectedValue(new Error('LinkedIn returned HTTP 429'));
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/slowing down searches/i);
    expect(json.error).not.toContain('429');
    expect(json.detail).toMatchObject({ reason: 'rate_limited', retryable: true });
  });

  it('allows repeated job searches for the same user', async () => {
    mockSearchJobs.mockResolvedValue({ jobs: [] });

    const { POST } = await import('@/app/api/jobs/search/route');
    for (let i = 0; i < 8; i++) {
      const ok = await POST(makeReq({ query: 'python' }));
      expect(ok.status).toBe(200);
    }
  });
});
