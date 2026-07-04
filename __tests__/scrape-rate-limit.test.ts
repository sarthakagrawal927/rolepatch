import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === 'cf-connecting-ip' ? '203.0.113.10' : null),
  }),
}));

const mockFetch = vi.fn();
const SCRAPE_RATE_LIMIT_MAX = 20;

beforeEach(async () => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  mockFetch.mockImplementation(
    () => new Response('# Senior Platform Engineer\n\nBuild reliable systems.', { status: 200 })
  );
  const { resetScrapeRateLimitsForTests } = await import('@/lib/actions/scrape-action');
  await resetScrapeRateLimitsForTests();
});

describe('scrape rate limiting', () => {
  it('returns a typed rate-limit outcome after too many scrape attempts', async () => {
    const { scrapeJobUrlSafe } = await import('@/lib/actions/scrape-action');

    for (let i = 0; i < SCRAPE_RATE_LIMIT_MAX; i++) {
      const result = await scrapeJobUrlSafe(`https://example.com/jobs/${i}`);
      expect(result.ok).toBe(true);
    }

    const limited = await scrapeJobUrlSafe('https://example.com/jobs/limited');

    expect(limited).toMatchObject({
      ok: false,
      reason: 'rate_limited',
    });
    if (!limited.ok) {
      expect(limited.message).toMatch(/paste the job description/i);
    }
    expect(mockFetch).toHaveBeenCalledTimes(SCRAPE_RATE_LIMIT_MAX);
  });
});
