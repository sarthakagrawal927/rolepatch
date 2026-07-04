import { describe, expect, it, vi } from 'vitest';

import {
  batchKnowledgebaseDocuments,
  isKnowledgebaseSimilarityConfigured,
  normalizeKnowledgebaseSimilarityScore,
  rankRolePatchJobsWithKnowledgebase,
  rankRolePatchJobsWithKnowledgebaseScores,
  scoreRolePatchJobWithKnowledgebase,
} from '@/lib/knowledgebase-similarity';

const jobs = [
  {
    id: 'job-a',
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    description: 'React accessibility dashboards',
  },
  {
    id: 'job-b',
    title: 'AI Product Engineer',
    company: 'Beta',
    description: 'RAG workflows with embeddings and ranking',
  },
  {
    id: 'job-c',
    title: 'Data Analyst',
    company: 'Gamma',
    description: 'SQL reporting and finance analytics',
  },
];

describe('knowledgebase similarity', () => {
  it('stays disabled until the service key and RolePatch index are configured', async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    expect(isKnowledgebaseSimilarityConfigured({ env: {}, fetchImpl })).toBe(false);
    await expect(
      rankRolePatchJobsWithKnowledgebase('user-1', 'resume', jobs, 3, {
        env: {},
        fetchImpl,
        serviceBinding: null,
      })
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('batches documents by request byte budget', () => {
    const batches = batchKnowledgebaseDocuments(
      [
        { external_id: 'a', content: 'a'.repeat(20), metadata: { job_id: 'a' } },
        { external_id: 'b', content: 'b'.repeat(20), metadata: { job_id: 'b' } },
      ],
      80
    );

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(1);
    expect(batches[1]).toHaveLength(1);
  });

  it('normalizes raw similarity scores to a 0-100 percentage', () => {
    expect(normalizeKnowledgebaseSimilarityScore(0.87)).toBe(87);
    expect(normalizeKnowledgebaseSimilarityScore(72.4)).toBe(72);
    expect(normalizeKnowledgebaseSimilarityScore(120)).toBe(100);
    expect(normalizeKnowledgebaseSimilarityScore(-0.2)).toBe(0);
  });

  it('ingests jobs through the service binding and returns semantic ranking order', async () => {
    const requests: Array<{ url: string; body: unknown; auth: string | null }> = [];
    const serviceBinding = {
      fetch: vi.fn(async (request: Request) => {
        requests.push({
          url: request.url,
          body: await request.clone().json(),
          auth: request.headers.get('authorization'),
        });
        if (request.url.endsWith('/ingest')) {
          return Response.json({ documents: [{ id: '1' }, { id: '2' }, { id: '3' }] });
        }
        return Response.json({
          data: [
            { score: 0.92, metadata: { job_id: 'job-b' } },
            { score: 0.81, metadata: { job_id: 'job-a' } },
            { score: 0.12, metadata: { job_id: 'unknown-job' } },
          ],
        });
      }),
    };

    const ranked = await rankRolePatchJobsWithKnowledgebase(
      'user-1',
      'resume with embeddings and product work',
      jobs,
      3,
      {
        env: {
          RAG_SERVICE_KEY: 'rag-secret',
          ROLEPATCH_RAG_INDEX_ID: 'rolepatch-jobs',
        },
        serviceBinding,
      }
    );

    expect(ranked?.map((job) => job.id)).toEqual(['job-b', 'job-a', 'job-c']);
    expect(serviceBinding.fetch).toHaveBeenCalledTimes(2);
    expect(requests.map((request) => request.url)).toEqual([
      'https://knowledgebase.internal/v1/indexes/rolepatch-jobs/ingest',
      'https://knowledgebase.internal/v1/indexes/rolepatch-jobs/query',
    ]);
    expect(requests.every((request) => request.auth === 'Bearer rag-secret')).toBe(true);
    const ingestBody = requests[0].body as {
      documents: Array<{ metadata: Record<string, unknown> }>;
    };
    expect(ingestBody.documents).toHaveLength(3);
    expect(ingestBody.documents[0].metadata).toMatchObject({
      user_id: 'user-1',
      job_id: 'job-a',
      source: 'rolepatch-fit-score',
    });
    expect(ingestBody.documents[0]).toMatchObject({
      external_id: 'rolepatch:user-1:job:job-a',
    });
    expect(requests[1].body).toMatchObject({
      query: 'resume with embeddings and product work',
      top_k: 3,
      mode: 'semantic',
      filter: { user_id: 'user-1' },
    });
  });

  it('returns the normalized semantic score for a single job', async () => {
    const requests: Array<{ body: unknown }> = [];
    const serviceBinding = {
      fetch: vi.fn(async (request: Request) => {
        requests.push({ body: request.url.endsWith('/query') ? await request.clone().json() : {} });
        if (request.url.endsWith('/ingest')) {
          return Response.json({ documents: [{ id: '1' }] });
        }
        return Response.json({
          data: [{ score: 0.735, metadata: { job_id: 'job-b' } }],
        });
      }),
    };

    const score = await scoreRolePatchJobWithKnowledgebase(
      'user-1',
      'resume with embeddings and product work',
      jobs[1],
      {
        env: {
          RAG_SERVICE_KEY: 'rag-secret',
          ROLEPATCH_RAG_INDEX_ID: 'rolepatch-jobs',
        },
        serviceBinding,
      }
    );

    expect(score).toBe(74);
    expect(requests.at(-1)?.body).toMatchObject({ top_k: 20 });
  });

  it('returns normalized semantic scores with ranked jobs', async () => {
    const serviceBinding = {
      fetch: vi.fn(async (request: Request) => {
        if (request.url.endsWith('/ingest')) {
          return Response.json({ documents: [{ id: '1' }, { id: '2' }] });
        }
        return Response.json({
          data: [
            { score: 0.927, metadata: { job_id: 'job-b' } },
            { score: 81, metadata: { job_id: 'job-a' } },
          ],
        });
      }),
    };

    const ranked = await rankRolePatchJobsWithKnowledgebaseScores(
      'user-1',
      'resume with product and embeddings',
      jobs,
      2,
      {
        env: {
          RAG_SERVICE_KEY: 'rag-secret',
          ROLEPATCH_RAG_INDEX_ID: 'rolepatch-jobs',
        },
        serviceBinding,
      }
    );

    expect(ranked?.map((result) => ({ id: result.job.id, score: result.score }))).toEqual([
      { id: 'job-b', score: 93 },
      { id: 'job-a', score: 81 },
      { id: 'job-c', score: 0 },
    ]);
  });

  it('deduplicates repeated Knowledgebase chunks before ranking the remaining jobs', async () => {
    const serviceBinding = {
      fetch: vi.fn(async (request: Request) => {
        if (request.url.endsWith('/ingest')) {
          return Response.json({ documents: [{ id: '1' }, { id: '2' }] });
        }
        return Response.json({
          data: [
            { score: 0.93, metadata: { job_id: 'job-a' } },
            { score: 0.91, metadata: { job_id: 'job-a' } },
            { score: 0.82, metadata: { job_id: 'job-b' } },
          ],
        });
      }),
    };

    const ranked = await rankRolePatchJobsWithKnowledgebase('user-1', 'resume', jobs, 2, {
      env: {
        RAG_SERVICE_KEY: 'rag-secret',
        ROLEPATCH_RAG_INDEX_ID: 'rolepatch-jobs',
      },
      serviceBinding,
    });

    expect(ranked?.map((job) => job.id)).toEqual(['job-a', 'job-b', 'job-c']);
  });
});
