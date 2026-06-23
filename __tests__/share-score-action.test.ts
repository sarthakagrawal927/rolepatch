import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [] });
});

describe('share-score-action auth guards', () => {
  it('publishScore throws when signed out (no DB touched)', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { publishScore } = await import('@/lib/actions/share-score-action');
    await expect(publishScore('tailored-id')).rejects.toThrow(/sign in/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('unpublishScore throws when signed out (no DB touched)', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { unpublishScore } = await import('@/lib/actions/share-score-action');
    await expect(unpublishScore('tailored-id')).rejects.toThrow(/sign in/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('getShareStateForTailored returns empty state when signed out', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { getShareStateForTailored } = await import('@/lib/actions/share-score-action');
    const state = await getShareStateForTailored('tailored-id');
    expect(state).toEqual({ isPublic: false, slug: null });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe('getPublicScoreBySlug', () => {
  it('rejects non-hex or wrong-length slugs without a DB read', async () => {
    const { getPublicScoreBySlug } = await import('@/lib/actions/share-score-action');
    expect(await getPublicScoreBySlug('')).toBeNull();
    expect(await getPublicScoreBySlug('not-hex!')).toBeNull();
    expect(await getPublicScoreBySlug('abc')).toBeNull();
    expect(await getPublicScoreBySlug('abcdefgh123')).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns null for valid-shape but missing slug', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const { getPublicScoreBySlug } = await import('@/lib/actions/share-score-action');
    expect(await getPublicScoreBySlug('deadbeef')).toBeNull();
  });

  it('returns minimal public-safe fields only (no resume source, no company, no user id)', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          score_original: 42,
          score_tailored: 87,
          role: 'Senior Backend Engineer',
          // these should be ignored even if the row had them
          source: 'SECRET RESUME',
          company: 'Acme',
          user_id: 'user-123',
        },
      ],
    });
    const { getPublicScoreBySlug } = await import('@/lib/actions/share-score-action');
    const data = await getPublicScoreBySlug('abcd1234');
    expect(data).toEqual({
      score_original: 42,
      score_tailored: 87,
      role: 'Senior Backend Engineer',
    });
    expect(data).not.toHaveProperty('source');
    expect(data).not.toHaveProperty('company');
    expect(data).not.toHaveProperty('user_id');
  });
});
