import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auth mock — unauthenticated by default
const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

// Token action mocks — so we can assert debit/refund semantics without DB
const mockDebitToken = vi.fn();
const mockCreditTokens = vi.fn();
vi.mock('@/lib/actions/token-actions', () => ({
  debitToken: (...args: unknown[]) => mockDebitToken(...args),
  creditTokens: (...args: unknown[]) => mockCreditTokens(...args),
}));

// AI mock — intercept `generateObject` from the `ai` package
const mockGenerateObject = vi.fn();
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

// getAIModel builds its model via @ai-sdk/openai-compatible's
// createOpenAICompatible. Return a sentinel so generateObject calls can
// assert on `model`.
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => ({ chatModel: () => ({ _model: 'mock' }) })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}));

function makeJobs(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `job-${i}`,
    title: `Role ${i}`,
    company: `Co ${i}`,
    description: 'x'.repeat(2000), // long enough to trigger truncation
  }));
}

function fakeRating(id: string, score = 7) {
  return {
    id,
    score,
    rationale: 'ok',
    strengths: ['s1'],
    gaps: ['g1'],
  };
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockDebitToken.mockReset();
  mockCreditTokens.mockReset();
  mockGenerateObject.mockReset();
});

describe('rateJobsBulk', () => {
  it('returns empty map for empty input (no AI, no auth work)', async () => {
    const { rateJobsBulk } = await import('@/lib/actions/bulk-rate-action');
    const result = await rateJobsBulk('RESUME', [], {} as unknown as never);
    expect(result).toEqual({});
    expect(mockGenerateObject).not.toHaveBeenCalled();
    expect(mockGetCurrentUserId).not.toHaveBeenCalled();
    expect(mockDebitToken).not.toHaveBeenCalled();
  });

  it('signed-out: skips tokens and still returns ratings', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const jobs = makeJobs(3);
    mockGenerateObject.mockResolvedValueOnce({
      object: { ratings: jobs.map((j) => fakeRating(j.id)) },
    });

    const { rateJobsBulk } = await import('@/lib/actions/bulk-rate-action');
    const result = await rateJobsBulk('RESUME', jobs, {} as unknown as never);

    expect(Object.keys(result)).toHaveLength(3);
    expect(result['job-0']).toEqual({ score: 7, rationale: 'ok', strengths: ['s1'], gaps: ['g1'] });
    expect(mockDebitToken).not.toHaveBeenCalled();
    expect(mockCreditTokens).not.toHaveBeenCalled();
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it('batches >20 jobs into multiple sequential AI calls', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const jobs = makeJobs(45); // 20 + 20 + 5 = 3 batches
    mockGenerateObject.mockImplementation(async ({ prompt }: { prompt: string }) => {
      // Parse which ids the batch references via the injected `id: X` header.
      const ids = [...prompt.matchAll(/\(id: (job-\d+)\)/g)].map((m) => m[1]);
      return { object: { ratings: ids.map((id) => fakeRating(id, 5)) } };
    });

    const { rateJobsBulk } = await import('@/lib/actions/bulk-rate-action');
    const result = await rateJobsBulk('RESUME', jobs, {} as unknown as never);

    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
    expect(Object.keys(result)).toHaveLength(45);
    // Spot-check first + last id
    expect(result['job-0'].score).toBe(5);
    expect(result['job-44'].score).toBe(5);
  });

  it('signed-in: debits ceil(jobs/20) tokens before AI calls', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockDebitToken.mockResolvedValue({ success: true, balance: 10 });
    const jobs = makeJobs(25); // 2 batches → 2 tokens
    mockGenerateObject.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const ids = [...prompt.matchAll(/\(id: (job-\d+)\)/g)].map((m) => m[1]);
      return { object: { ratings: ids.map((id) => fakeRating(id)) } };
    });

    const { rateJobsBulk } = await import('@/lib/actions/bulk-rate-action');
    await rateJobsBulk('RESUME', jobs, {} as unknown as never);

    expect(mockDebitToken).toHaveBeenCalledTimes(2);
    expect(mockCreditTokens).not.toHaveBeenCalled();
  });

  it('signed-in: throws and refunds already-debited tokens if a debit fails mid-way', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockDebitToken
      .mockResolvedValueOnce({ success: true, balance: 1 })
      .mockResolvedValueOnce({ success: false, error: 'insufficient_tokens' });

    const jobs = makeJobs(25); // would need 2 tokens
    const { rateJobsBulk } = await import('@/lib/actions/bulk-rate-action');

    await expect(rateJobsBulk('RESUME', jobs, {} as unknown as never)).rejects.toThrow(
      /No tokens remaining/i
    );
    // Already-debited token(s) must be refunded
    expect(mockCreditTokens).toHaveBeenCalledWith('user-1', 1, 'refund', 'ai_failure');
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('signed-in: refunds all tokens if AI call throws', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockDebitToken.mockResolvedValue({ success: true, balance: 10 });
    mockGenerateObject.mockRejectedValueOnce(new Error('AI blew up'));

    const jobs = makeJobs(25); // 2 tokens
    const { rateJobsBulk } = await import('@/lib/actions/bulk-rate-action');

    await expect(rateJobsBulk('RESUME', jobs, {} as unknown as never)).rejects.toThrow(
      /AI blew up/
    );
    expect(mockCreditTokens).toHaveBeenCalledWith('user-1', 2, 'refund', 'ai_failure');
  });

  it('truncates each job description to 1500 chars in the prompt', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const jobs = makeJobs(1);
    mockGenerateObject.mockResolvedValueOnce({ object: { ratings: [fakeRating('job-0')] } });

    const { rateJobsBulk } = await import('@/lib/actions/bulk-rate-action');
    await rateJobsBulk('RESUME', jobs, {} as unknown as never);

    const [[call]] = mockGenerateObject.mock.calls as [[{ prompt: string }]];
    // Count consecutive x runs in the prompt — the longest one should equal 1500 (our truncation).
    const longestX = Math.max(...[...call.prompt.matchAll(/x+/g)].map((m) => m[0].length));
    expect(longestX).toBe(1500);
  });
});
