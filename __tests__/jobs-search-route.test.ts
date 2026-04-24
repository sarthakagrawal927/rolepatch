import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

// NextAuth's server helpers pull in ESM-only packages; stub them out for jsdom.
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {}, auth: vi.fn() }));

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  vi.resetModules();
  process.env.JOBSPY_API_KEY = 'secret';
  delete process.env.VERCEL_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

function makeReq(body: unknown, origin = 'http://localhost') {
  return new Request(`${origin}/api/jobs/search`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as Parameters<typeof import('@/app/api/jobs/search/route')['POST']>[0];
}

function okFetch(payload: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('POST /api/jobs/search', () => {
  it('rejects unauthenticated requests with 401', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(401);
  });

  it('returns 503 when JOBSPY_API_KEY is missing', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-config');
    delete process.env.JOBSPY_API_KEY;
    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(503);
  });

  it('forwards to same-origin Python function with bearer auth', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-forward');
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ jobs: [{ id: 'abc' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python engineer' }, 'https://rolepatch.com'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.jobs).toHaveLength(1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://rolepatch.com/api/python/jobs-search');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
  });

  it('honors VERCEL_URL when set', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-vercel');
    process.env.VERCEL_URL = 'preview-abc.vercel.app';
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ jobs: [] }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { POST } = await import('@/app/api/jobs/search/route');
    await POST(makeReq({ query: 'python' }));
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://preview-abc.vercel.app/api/python/jobs-search');
  });

  it('maps 5xx from Python function to 502', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-5xx');
    globalThis.fetch = vi.fn(
      async () => new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;

    const { POST } = await import('@/app/api/jobs/search/route');
    const res = await POST(makeReq({ query: 'python' }));
    expect(res.status).toBe(502);
  });

  it('rate-limits a single user after 5 calls/min', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-rate');
    globalThis.fetch = okFetch({ jobs: [] });

    const { POST } = await import('@/app/api/jobs/search/route');
    for (let i = 0; i < 5; i++) {
      const ok = await POST(makeReq({ query: 'python' }));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(makeReq({ query: 'python' }));
    expect(blocked.status).toBe(429);
  });
});
