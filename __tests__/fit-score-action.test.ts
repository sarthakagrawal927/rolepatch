import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getCurrentUserId: vi.fn(),
  debitToken: vi.fn(),
  creditTokens: vi.fn(),
  dbExecute: vi.fn(),
  trackCoreAction: vi.fn(),
  scoreRolePatchJobWithKnowledgebase: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mocks.generateText(...args),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => ({ chatModel: () => ({ _model: 'mock' }) })),
}));

vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mocks.getCurrentUserId(),
}));

vi.mock('@/lib/actions/token-actions', () => ({
  debitToken: (...args: unknown[]) => mocks.debitToken(...args),
  creditTokens: (...args: unknown[]) => mocks.creditTokens(...args),
}));

vi.mock('@/lib/db', () => ({
  db: {
    execute: (...args: unknown[]) => mocks.dbExecute(...args),
  },
}));

vi.mock('@/lib/analytics', () => ({
  trackCoreAction: (...args: unknown[]) => mocks.trackCoreAction(...args),
}));

vi.mock('@/lib/knowledgebase-similarity', () => ({
  scoreRolePatchJobWithKnowledgebase: (...args: unknown[]) =>
    mocks.scoreRolePatchJobWithKnowledgebase(...args),
}));

const fitScoreJson = {
  overall: 82,
  dimensions: [
    { name: 'Role Alignment', score: 85, weight: 25, detail: 'Strong role match.' },
    { name: 'Skills Match', score: 80, weight: 25, detail: 'Core skills overlap.' },
  ],
  strengths: ['Relevant product work'],
  gaps: ['Could show more scale'],
  recommendation: 'Lead with product and AI systems work.',
};

beforeEach(() => {
  vi.resetModules();
  mocks.generateText.mockReset();
  mocks.getCurrentUserId.mockReset();
  mocks.debitToken.mockReset();
  mocks.creditTokens.mockReset();
  mocks.dbExecute.mockReset();
  mocks.trackCoreAction.mockReset();
  mocks.scoreRolePatchJobWithKnowledgebase.mockReset();
  mocks.generateText.mockResolvedValue({ text: JSON.stringify(fitScoreJson) });
  mocks.debitToken.mockResolvedValue({ success: true, balance: 5 });
  mocks.scoreRolePatchJobWithKnowledgebase.mockResolvedValue(null);
});

describe('generateFitScore', () => {
  it('adds Knowledgebase semantic similarity as visible fit-score evidence', async () => {
    mocks.getCurrentUserId.mockResolvedValue('user-1');
    mocks.dbExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            role: 'AI Product Engineer',
            company: 'Acme',
            jd_text: 'Build RAG features with Cloudflare.',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    mocks.scoreRolePatchJobWithKnowledgebase.mockResolvedValue(91);

    const { generateFitScore } = await import('@/lib/actions/fit-score-action');
    const result = await generateFitScore(
      'Resume with RAG product work',
      'Job description',
      'job-1',
      {
        endpointUrl: 'https://ai.example/v1',
        apiKey: 'key',
        model: 'model',
      }
    );

    expect(result.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Semantic Similarity',
          score: 91,
          weight: 0,
        }),
      ])
    );
    expect(mocks.scoreRolePatchJobWithKnowledgebase).toHaveBeenCalledWith(
      'user-1',
      'Resume with RAG product work',
      expect.objectContaining({
        id: 'job-1',
        title: 'AI Product Engineer',
        company: 'Acme',
        description: 'Build RAG features with Cloudflare.',
      })
    );
    const insertCall = mocks.dbExecute.mock.calls[1]?.[0] as { args: unknown[] };
    expect(JSON.parse(insertCall.args[4] as string)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Semantic Similarity',
          score: 91,
          weight: 0,
        }),
      ])
    );
  });

  it('keeps fit scoring usable when Knowledgebase similarity is unavailable', async () => {
    mocks.getCurrentUserId.mockResolvedValue('user-1');
    mocks.dbExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            role: 'AI Product Engineer',
            company: 'Acme',
            jd_text: 'Build RAG features with Cloudflare.',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    mocks.scoreRolePatchJobWithKnowledgebase.mockRejectedValue(new Error('RAG down'));

    const { generateFitScore } = await import('@/lib/actions/fit-score-action');
    const result = await generateFitScore('Resume', 'Job description', 'job-1', {
      endpointUrl: 'https://ai.example/v1',
      apiKey: 'key',
      model: 'model',
    });

    expect(result.overall_score).toBe(82);
    expect(result.dimensions.some((dimension) => dimension.name === 'Semantic Similarity')).toBe(
      false
    );
    expect(mocks.creditTokens).not.toHaveBeenCalled();
  });
});
