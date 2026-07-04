import { getCloudflareContext } from '@opennextjs/cloudflare';

type ServiceBinding = {
  fetch(request: Request): Promise<Response>;
};

type CloudflareEnv = {
  RAG_SERVICE?: ServiceBinding;
  RAG_SERVICE_KEY?: string;
  ROLEPATCH_RAG_INDEX_ID?: string;
};

export interface RolePatchSimilarityJob {
  id: string;
  title: string;
  company: string;
  location?: string;
  description: string;
}

interface KnowledgebaseResult {
  score: number;
  metadata?: Record<string, unknown>;
}

interface SimilarJobResult {
  jobId: string;
  score: number;
}

export interface RolePatchSimilarityRankedJob {
  job: RolePatchSimilarityJob;
  score: number;
}

interface KnowledgebaseDocument {
  external_id: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface SimilarityConfig {
  serviceKey: string;
  indexId: string;
  serviceUrl: string;
  serviceBinding: ServiceBinding | null;
  fetchImpl: typeof fetch;
}

interface SimilarityOptions {
  env?: Record<string, string | undefined>;
  serviceBinding?: ServiceBinding | null;
  serviceUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_RAG_SERVICE_URL = 'https://knowledgebase.sarthakagrawal927.workers.dev';
const DEFAULT_RAG_INGEST_BATCH_BYTES = 750_000;
const KNOWLEDGEBASE_MAX_TOP_K = 50;
const JOB_DESCRIPTION_CHAR_LIMIT = 8_000;

function cloudflareEnv(): CloudflareEnv {
  try {
    const { env } = getCloudflareContext({ async: false });
    return env as CloudflareEnv;
  } catch {
    return {};
  }
}

function configuredValue(
  name: 'RAG_SERVICE_KEY' | 'ROLEPATCH_RAG_INDEX_ID',
  env: Record<string, string | undefined>,
  cfEnv: CloudflareEnv
): string {
  return env[name]?.trim() || cfEnv[name]?.trim() || '';
}

function getSimilarityConfig(options: SimilarityOptions = {}): SimilarityConfig | null {
  const env = options.env ?? process.env;
  const cfEnv = options.serviceBinding === undefined ? cloudflareEnv() : {};
  const serviceKey = configuredValue('RAG_SERVICE_KEY', env, cfEnv);
  const indexId = configuredValue('ROLEPATCH_RAG_INDEX_ID', env, cfEnv);
  if (!serviceKey || !indexId) return null;

  return {
    serviceKey,
    indexId,
    serviceUrl: (options.serviceUrl ?? env.RAG_SERVICE_URL ?? DEFAULT_RAG_SERVICE_URL).replace(
      /\/+$/,
      ''
    ),
    serviceBinding: options.serviceBinding ?? cfEnv.RAG_SERVICE ?? null,
    fetchImpl: options.fetchImpl ?? fetch,
  };
}

export function isKnowledgebaseSimilarityConfigured(options: SimilarityOptions = {}): boolean {
  return Boolean(getSimilarityConfig(options));
}

async function knowledgebaseFetch(
  config: SimilarityConfig,
  path: string,
  init: RequestInit
): Promise<Response> {
  const requestInit: RequestInit = {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.serviceKey}`,
      ...(init.headers ?? {}),
    },
  };
  if (config.serviceBinding) {
    return config.serviceBinding.fetch(
      new Request(`https://knowledgebase.internal${path}`, requestInit)
    );
  }
  return config.fetchImpl(`${config.serviceUrl}${path}`, requestInit);
}

function jobContent(job: RolePatchSimilarityJob): string {
  const location = job.location ? `\nLocation: ${job.location}` : '';
  return [
    `Role: ${job.title}`,
    `Company: ${job.company}${location}`,
    '',
    job.description.slice(0, JOB_DESCRIPTION_CHAR_LIMIT),
  ].join('\n');
}

function jobDocument(userId: string, job: RolePatchSimilarityJob): KnowledgebaseDocument {
  return {
    external_id: `rolepatch:${userId}:job:${job.id}`,
    content: jobContent(job),
    metadata: {
      user_id: userId,
      job_id: job.id,
      role: job.title,
      company: job.company,
      location: job.location ?? '',
      source: 'rolepatch-fit-score',
    },
  };
}

export function batchKnowledgebaseDocuments(
  documents: KnowledgebaseDocument[],
  maxBytes = DEFAULT_RAG_INGEST_BATCH_BYTES
): KnowledgebaseDocument[][] {
  const batches: KnowledgebaseDocument[][] = [];
  let current: KnowledgebaseDocument[] = [];
  let currentBytes = JSON.stringify({ documents: [] }).length;

  for (const document of documents) {
    const documentBytes = JSON.stringify(document).length + 1;
    if (current.length > 0 && currentBytes + documentBytes > maxBytes) {
      batches.push(current);
      current = [];
      currentBytes = JSON.stringify({ documents: [] }).length;
    }
    current.push(document);
    currentBytes += documentBytes;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

async function ingestJobs(
  config: SimilarityConfig,
  userId: string,
  jobs: RolePatchSimilarityJob[]
): Promise<void> {
  const documents = jobs.map((job) => jobDocument(userId, job));
  for (const batch of batchKnowledgebaseDocuments(documents)) {
    const res = await knowledgebaseFetch(config, `/v1/indexes/${config.indexId}/ingest`, {
      method: 'POST',
      body: JSON.stringify({ documents: batch }),
    });
    if (!res.ok) throw new Error(`Knowledgebase ingest failed ${res.status}: ${await res.text()}`);
  }
}

async function querySimilarJobs(
  config: SimilarityConfig,
  userId: string,
  resumeSource: string,
  topK: number
): Promise<SimilarJobResult[]> {
  const cappedTopK = Math.min(Math.max(Math.trunc(topK), 1), KNOWLEDGEBASE_MAX_TOP_K);
  const res = await knowledgebaseFetch(config, `/v1/indexes/${config.indexId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      query: resumeSource,
      top_k: cappedTopK,
      mode: 'semantic',
      filter: { user_id: userId },
    }),
  });
  if (!res.ok) throw new Error(`Knowledgebase query failed ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data?: KnowledgebaseResult[] };
  const results: SimilarJobResult[] = [];
  const seen = new Set<string>();
  for (const result of body.data ?? []) {
    const jobId = result.metadata?.job_id;
    if (typeof jobId !== 'string' || seen.has(jobId)) continue;
    seen.add(jobId);
    results.push({ jobId, score: result.score });
  }
  return results;
}

export function normalizeKnowledgebaseSimilarityScore(score: number): number {
  const percent = score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export async function rankRolePatchJobsWithKnowledgebase(
  userId: string,
  resumeSource: string,
  jobs: RolePatchSimilarityJob[],
  topK = jobs.length,
  options: SimilarityOptions = {}
): Promise<RolePatchSimilarityJob[] | null> {
  const rankedWithScores = await rankRolePatchJobsWithKnowledgebaseScores(
    userId,
    resumeSource,
    jobs,
    topK,
    options
  );
  return rankedWithScores?.map((result) => result.job) ?? null;
}

export async function rankRolePatchJobsWithKnowledgebaseScores(
  userId: string,
  resumeSource: string,
  jobs: RolePatchSimilarityJob[],
  topK = jobs.length,
  options: SimilarityOptions = {}
): Promise<RolePatchSimilarityRankedJob[] | null> {
  const config = getSimilarityConfig(options);
  if (!config || !userId || !resumeSource.trim() || jobs.length === 0) return null;

  await ingestJobs(config, userId, jobs);
  const queryTopK = Math.min(Math.max(topK, jobs.length), KNOWLEDGEBASE_MAX_TOP_K);
  const ranked = await querySimilarJobs(config, userId, resumeSource, queryTopK);
  if (ranked.length === 0) return null;

  const byId = new Map(jobs.map((job) => [job.id, job]));
  const rankedJobs = ranked
    .map((result) => {
      const job = byId.get(result.jobId);
      return job ? { job, score: normalizeKnowledgebaseSimilarityScore(result.score) } : null;
    })
    .filter((result): result is RolePatchSimilarityRankedJob => Boolean(result));
  if (rankedJobs.length === 0) return null;

  const rankedSet = new Set(rankedJobs.map((result) => result.job.id));
  const remainder = jobs.filter((job) => !rankedSet.has(job.id)).map((job) => ({ job, score: 0 }));
  return [...rankedJobs, ...remainder];
}

export async function scoreRolePatchJobWithKnowledgebase(
  userId: string,
  resumeSource: string,
  job: RolePatchSimilarityJob,
  options: SimilarityOptions = {}
): Promise<number | null> {
  const config = getSimilarityConfig(options);
  if (!config || !userId || !resumeSource.trim() || !job.description.trim()) return null;

  await ingestJobs(config, userId, [job]);
  // The legacy Knowledgebase index API preserves repeated ingests, so a wider
  // single-job lookup avoids older duplicate chunks crowding out the target.
  const ranked = await querySimilarJobs(config, userId, resumeSource, 20);
  const match = ranked.find((result) => result.jobId === job.id);
  return match ? normalizeKnowledgebaseSimilarityScore(match.score) : null;
}
