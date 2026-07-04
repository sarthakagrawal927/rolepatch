import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as TrueHirePreviewRoute from '@/app/api/proof/truehire-preview/route';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/proof/truehire-preview', () => {
  it('rejects invalid handles before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/proof/truehire-preview/route');

    const res = await GET(
      new Request('https://rolepatch.com/api/proof/truehire-preview?handle=https://evil.test/x')
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a TrueHire public export into proof preview JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        handle: 'sarthak',
        score: {
          overall: 91,
          signal1: 91,
          signal2: 0,
          totalCommits: 1200,
          totalRepos: 18,
          totalStars: 400,
          monthsActive: 30,
          evidenceJson: JSON.stringify([
            {
              repoFullName: 'sarthak/rolepatch',
              commits: 250,
              stars: 40,
              mergedPrs: 4,
              primaryLanguage: 'TypeScript',
              weight: 50,
            },
          ]),
        },
        workHistory: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('@/app/api/proof/truehire-preview/route');

    const res = await GET(
      new Request('https://rolepatch.com/api/proof/truehire-preview?handle=@sarthak') as Parameters<
        typeof TrueHirePreviewRoute.GET
      >[0]
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://truehire.sarthakagrawal927.workers.dev/@sarthak/data.json',
      expect.objectContaining({ cache: 'no-store' })
    );
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      profile: {
        handle: 'sarthak',
        overall_score: 91,
      },
      items: [
        expect.objectContaining({
          title: 'sarthak/rolepatch',
          readiness: 'Verified public work',
        }),
      ],
    });
  });

  it('returns a stable not-found error for missing TrueHire profiles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      })
    );
    const { GET } = await import('@/app/api/proof/truehire-preview/route');

    const res = await GET(
      new Request('https://rolepatch.com/api/proof/truehire-preview?handle=@missing')
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'TrueHire profile not found.' });
  });
});
