import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  mockRevalidatePath.mockReset();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('importTrueHireProofEvidence', () => {
  it('imports TrueHire public proof into signed-in achievement evidence', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          handle: 'sarthak',
          score: {
            overall: 88,
            totalCommits: 1234,
            totalRepos: 20,
            totalStars: 300,
            monthsActive: 30,
            evidenceJson: JSON.stringify([
              {
                repoFullName: 'sarthak/rolepatch',
                commits: 250,
                mergedPrs: 4,
                stars: 40,
                primaryLanguage: 'TypeScript',
                weight: 100,
              },
            ]),
          },
          workHistory: [],
        }),
      })
    );

    const { importTrueHireProofEvidence } = await import(
      '@/lib/actions/achievement-evidence-actions'
    );
    const result = await importTrueHireProofEvidence('@sarthak');

    expect(result).toEqual({ handle: 'sarthak', imported: 1, skipped: 0 });
    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(mockExecute.mock.calls[1][0]).toMatchObject({
      sql: expect.stringContaining('INSERT INTO achievement_evidence'),
      args: expect.arrayContaining([
        'user-1',
        '[TrueHire] sarthak/rolepatch',
        expect.stringContaining('Imported from TrueHire profile @sarthak'),
        'TrueHire public work',
        '250 commits · 4 merged PRs · 40 stars',
      ]),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/proof');
  });

  it('skips duplicate TrueHire evidence on repeat import', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          id: 'existing',
          title: '[TrueHire] sarthak/rolepatch',
          situation:
            'Imported from TrueHire profile @sarthak. Source: https://github.com/sarthak/rolepatch',
          action: 'TrueHire public work',
          result: '250 commits',
          metric: '250 commits',
          scope: 'Verified public work; TrueHire score 88',
          skills: '["TypeScript"]',
          role_targets: '["verified public work"]',
          impact_type: 'technical',
          created_at: 1,
          updated_at: 1,
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          handle: 'sarthak',
          score: {
            overall: 88,
            evidenceJson: JSON.stringify([
              {
                repoFullName: 'sarthak/rolepatch',
                commits: 250,
                primaryLanguage: 'TypeScript',
                weight: 100,
              },
            ]),
          },
          workHistory: [],
        }),
      })
    );

    const { importTrueHireProofEvidence } = await import(
      '@/lib/actions/achievement-evidence-actions'
    );
    const result = await importTrueHireProofEvidence('@sarthak');

    expect(result).toEqual({ handle: 'sarthak', imported: 0, skipped: 1 });
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
