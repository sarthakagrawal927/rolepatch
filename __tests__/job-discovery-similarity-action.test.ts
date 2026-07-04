import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rankDiscoveredJobsByResumeSimilarity } from '@/lib/actions/job-discovery-similarity-actions';
import type { DiscoveredJob } from '@/lib/job-discovery-types';

const { mockGetCurrentUserId, mockDbExecute, mockConfigured, mockRankWithKnowledgebase } =
  vi.hoisted(() => ({
    mockGetCurrentUserId: vi.fn(),
    mockDbExecute: vi.fn(),
    mockConfigured: vi.fn(),
    mockRankWithKnowledgebase: vi.fn(),
  }));

vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    execute: (...args: unknown[]) => mockDbExecute(...args),
  },
}));

vi.mock('@/lib/knowledgebase-similarity', () => ({
  isKnowledgebaseSimilarityConfigured: () => mockConfigured(),
  rankRolePatchJobsWithKnowledgebaseScores: (...args: unknown[]) =>
    mockRankWithKnowledgebase(...args),
}));

const jobs: DiscoveredJob[] = [
  {
    id: 'job-a',
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    description_short: 'React dashboards and accessibility',
  },
  {
    id: 'job-b',
    title: 'AI Product Engineer',
    company: 'Beta',
    location: 'New York',
    description: 'RAG workflows and semantic ranking',
  },
];

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockDbExecute.mockReset();
  mockConfigured.mockReset();
  mockRankWithKnowledgebase.mockReset();
});

describe('rankDiscoveredJobsByResumeSimilarity', () => {
  it('requires a signed-in user before using resume or Knowledgebase data', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    await expect(rankDiscoveredJobsByResumeSimilarity('resume-1', jobs)).resolves.toEqual({
      status: 'unavailable',
      orderedIds: ['job-a', 'job-b'],
      reason: 'sign_in_required',
    });
    expect(mockDbExecute).not.toHaveBeenCalled();
    expect(mockRankWithKnowledgebase).not.toHaveBeenCalled();
  });

  it('returns ordered discovery IDs from Knowledgebase semantic ranking', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockConfigured.mockReturnValue(true);
    mockDbExecute.mockResolvedValue({
      rows: [{ source: '# Resume\nBuilt RAG semantic ranking systems' }],
    });
    mockRankWithKnowledgebase.mockResolvedValue([
      {
        job: {
          id: 'job-b',
          title: 'AI Product Engineer',
          company: 'Beta',
          location: 'New York',
          description: 'RAG workflows and semantic ranking',
        },
        score: 92,
      },
      {
        job: {
          id: 'job-a',
          title: 'Frontend Engineer',
          company: 'Acme',
          location: 'Remote',
          description: 'React dashboards and accessibility',
        },
        score: 81,
      },
    ]);

    const result = await rankDiscoveredJobsByResumeSimilarity('resume-1', jobs);

    expect(result).toEqual({
      status: 'ranked',
      orderedIds: ['job-b', 'job-a'],
      rankedCount: 2,
      scoresById: { 'job-a': 81, 'job-b': 92 },
      matchTermsById: { 'job-b': ['RAG', 'Semantic', 'Ranking'] },
    });
    expect(mockDbExecute).toHaveBeenCalledWith({
      sql: 'SELECT source FROM resumes WHERE id = ? AND user_id = ?',
      args: ['resume-1', 'user-1'],
    });
    expect(mockRankWithKnowledgebase).toHaveBeenCalledWith(
      'user-1',
      '# Resume\nBuilt RAG semantic ranking systems',
      expect.arrayContaining([
        expect.objectContaining({ id: 'job-a', description: 'React dashboards and accessibility' }),
        expect.objectContaining({ id: 'job-b', description: 'RAG workflows and semantic ranking' }),
      ]),
      2
    );
  });

  it('keeps the current order when Knowledgebase is not configured', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockConfigured.mockReturnValue(false);

    await expect(rankDiscoveredJobsByResumeSimilarity('resume-1', jobs)).resolves.toEqual({
      status: 'unavailable',
      orderedIds: ['job-a', 'job-b'],
      reason: 'knowledgebase_unconfigured',
    });
    expect(mockDbExecute).not.toHaveBeenCalled();
  });
});
