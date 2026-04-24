import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/extension/tailor', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<typeof import('@/app/api/extension/tailor/route')['POST']>[0];
}

const longJd = 'Senior engineer role at '.repeat(20);

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  vi.resetModules();
});

describe('POST /api/extension/tailor', () => {
  it('rejects signed-out with 401', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/extension/tailor/route');
    const res = await POST(makeReq({ url: 'https://x', jd_text: longJd }));
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 400 when user has no resume', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute.mockResolvedValueOnce({ rows: [] }); // resume lookup → none
    const { POST } = await import('@/app/api/extension/tailor/route');
    const res = await POST(makeReq({ url: 'https://example.com/jobs/1', jd_text: longJd }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.redirect_url).toBe('/dashboard');
  });

  it('creates a new job row on happy path', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-happy');
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] }) // resume lookup
      .mockResolvedValueOnce({ rows: [] })                   // existing job lookup
      .mockResolvedValueOnce({ rows: [] });                  // insert
    const { POST } = await import('@/app/api/extension/tailor/route');
    const res = await POST(
      makeReq({
        url: 'https://boards.greenhouse.io/stripe/jobs/12345',
        title: 'Senior Backend',
        jd_text: longJd,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.job_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.redirect_url).toBe(`/tailor/${json.job_id}`);
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });

  it('returns existing job_id when same URL already tracked by this user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-idempotent');
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'job-existing' }] });
    const { POST } = await import('@/app/api/extension/tailor/route');
    const res = await POST(
      makeReq({ url: 'https://jobs.lever.co/acme/abc', jd_text: longJd }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.job_id).toBe('job-existing');
    expect(mockExecute).toHaveBeenCalledTimes(2); // no insert
  });

  it('rate-limits after 10 calls/min', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-rate');
    mockExecute.mockResolvedValue({ rows: [{ id: 'resume-1' }] });
    const { POST } = await import('@/app/api/extension/tailor/route');
    // Force the "existing job" branch so we don't need to mock insert each call.
    mockExecute
      .mockResolvedValue({ rows: [{ id: 'j' }] });
    for (let i = 0; i < 10; i++) {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ id: 'r' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'j' }] });
      const ok = await POST(makeReq({ url: `https://x/${i}`, jd_text: longJd }));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(makeReq({ url: 'https://x/11', jd_text: longJd }));
    expect(blocked.status).toBe(429);
  });

  it('rejects non-http(s) urls', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-nonhttp');
    const { POST } = await import('@/app/api/extension/tailor/route');
    const res = await POST(makeReq({ url: 'ftp://x.com', jd_text: longJd }));
    expect(res.status).toBe(400);
  });

  it('rejects short jd_text', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-short');
    const { POST } = await import('@/app/api/extension/tailor/route');
    const res = await POST(makeReq({ url: 'https://x.com', jd_text: 'short' }));
    expect(res.status).toBe(400);
  });
});
