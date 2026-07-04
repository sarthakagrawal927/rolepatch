'use server';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type { DiscoveredJob } from '@/lib/job-discovery-types';
import {
  isKnowledgebaseSimilarityConfigured,
  rankRolePatchJobsWithKnowledgebaseScores,
} from '@/lib/knowledgebase-similarity';

const MAX_DISCOVERY_RANK_JOBS = 50;

const MATCH_TERM_STOPWORDS = new Set([
  'and',
  'are',
  'with',
  'for',
  'from',
  'that',
  'this',
  'the',
  'you',
  'your',
  'our',
  'will',
  'role',
  'team',
  'work',
  'build',
  'built',
  'own',
  'using',
  'engineer',
  'engineering',
  'product',
  'products',
]);

const MATCH_TERM_LABELS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  aws: 'AWS',
  rag: 'RAG',
  sql: 'SQL',
};

export type DiscoverySimilarityRankResult =
  | {
      status: 'ranked';
      orderedIds: string[];
      rankedCount: number;
      scoresById: Record<string, number>;
      matchTermsById: Record<string, string[]>;
    }
  | {
      status: 'unavailable';
      orderedIds: string[];
      reason:
        | 'sign_in_required'
        | 'resume_missing'
        | 'knowledgebase_unconfigured'
        | 'no_descriptions'
        | 'no_matches'
        | 'service_unavailable';
    };

function descriptionForJob(job: DiscoveredJob): string {
  return (job.description ?? job.description_short ?? '').trim();
}

function extractMatchTerms(text: string): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/[a-z0-9][a-z0-9+#.-]*/gi)) {
    const term = match[0].toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
    if (!term || seen.has(term)) continue;
    if (term.length < 3 && !MATCH_TERM_LABELS[term]) continue;
    if (MATCH_TERM_STOPWORDS.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

function formatMatchTerm(term: string): string {
  return MATCH_TERM_LABELS[term] ?? term.replace(/^\w/, (char) => char.toUpperCase());
}

function semanticMatchTerms(
  resumeSource: string,
  job: {
    title: string;
    company: string;
    location?: string;
    description: string;
  }
): string[] {
  const resumeTerms = new Set(extractMatchTerms(resumeSource));
  const jobTerms = extractMatchTerms(
    [job.title, job.company, job.location, job.description].filter(Boolean).join(' ')
  );
  return jobTerms
    .filter((term) => resumeTerms.has(term))
    .slice(0, 4)
    .map(formatMatchTerm);
}

export async function rankDiscoveredJobsByResumeSimilarity(
  resumeId: string,
  jobs: DiscoveredJob[]
): Promise<DiscoverySimilarityRankResult> {
  const orderedIds = jobs.map((job) => job.id);
  const userId = await getCurrentUserId();
  if (!userId) return { status: 'unavailable', orderedIds, reason: 'sign_in_required' };
  if (!isKnowledgebaseSimilarityConfigured()) {
    return { status: 'unavailable', orderedIds, reason: 'knowledgebase_unconfigured' };
  }

  const resumeResult = await db.execute({
    sql: 'SELECT source FROM resumes WHERE id = ? AND user_id = ?',
    args: [resumeId, userId],
  });
  const resumeSource = String(resumeResult.rows[0]?.source ?? '').trim();
  if (!resumeSource) return { status: 'unavailable', orderedIds, reason: 'resume_missing' };

  const rankableJobs = jobs
    .slice(0, MAX_DISCOVERY_RANK_JOBS)
    .map((job) => ({
      id: job.id,
      title: job.title ?? 'Untitled role',
      company: job.company ?? 'Unknown company',
      location: job.location ?? undefined,
      description: descriptionForJob(job),
    }))
    .filter((job) => job.id && job.description);
  if (rankableJobs.length === 0) {
    return { status: 'unavailable', orderedIds, reason: 'no_descriptions' };
  }

  try {
    const rankedJobs = await rankRolePatchJobsWithKnowledgebaseScores(
      userId,
      resumeSource,
      rankableJobs,
      rankableJobs.length
    );
    if (!rankedJobs?.length) return { status: 'unavailable', orderedIds, reason: 'no_matches' };

    const rankedIds = rankedJobs.map((result) => result.job.id);
    const rankedSet = new Set(rankedIds);
    const scoresById = Object.fromEntries(
      rankedJobs.filter((result) => result.score > 0).map((result) => [result.job.id, result.score])
    );
    const matchTermsById = Object.fromEntries(
      rankedJobs
        .map((result) => [result.job.id, semanticMatchTerms(resumeSource, result.job)] as const)
        .filter(([, terms]) => terms.length > 0)
    );
    return {
      status: 'ranked',
      orderedIds: [...rankedIds, ...orderedIds.filter((id) => !rankedSet.has(id))],
      rankedCount: rankedIds.length,
      scoresById,
      matchTermsById,
    };
  } catch {
    return { status: 'unavailable', orderedIds, reason: 'service_unavailable' };
  }
}
