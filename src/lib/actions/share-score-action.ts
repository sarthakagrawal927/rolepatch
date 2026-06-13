'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

import { calculateATSScore } from '@/lib/ats-score';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';

export interface PublicScore {
  score_original: number;
  score_tailored: number;
  role: string;
}

function generateSlug(): string {
  // 8 hex chars = 4 bytes
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Publishes a tailored resume's ATS score publicly under a stable slug.
 * Computes and caches score_original / score_tailored at publish time so
 * the public route never touches resume/JD source (no PII leakage).
 */
export async function publishScore(tailoredId: string): Promise<{ slug: string }> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to share scores');

  // Load tailored row (owner-scoped) + its job/resume for scoring
  const tailoredRes = await db.execute({
    sql: `SELECT tr.id, tr.source, tr.share_slug, tr.job_id, tr.resume_id
          FROM tailored_resumes tr
          WHERE tr.id = ? AND tr.user_id = ?`,
    args: [tailoredId, userId],
  });
  const tailored = tailoredRes.rows[0];
  if (!tailored) throw new Error('Tailored resume not found');

  // Reuse existing slug if already published
  let slug = (tailored.share_slug as string | null) ?? null;
  if (!slug) {
    // Retry on rare collision with the partial unique index
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateSlug();
      try {
        const updateResult = await db.execute({
          sql: `UPDATE tailored_resumes SET share_slug = ? WHERE id = ? AND user_id = ? AND share_slug IS NULL`,
          args: [candidate, tailoredId, userId],
        });
        if ((updateResult.rowsAffected ?? 0) > 0) {
          slug = candidate;
          break;
        }
      } catch {
        // collision — try again
      }
    }
    if (!slug) throw new Error('Could not allocate share slug');
  }

  // Recompute scores against the current JD + base resume so the cached
  // values on the row reflect the source of truth.
  const jobRes = await db.execute({
    sql: 'SELECT jd_text FROM job_applications WHERE id = ? AND user_id = ?',
    args: [tailored.job_id as string, userId],
  });
  const jdText = (jobRes.rows[0]?.jd_text as string | undefined) ?? '';

  const resumeRes = await db.execute({
    sql: 'SELECT source FROM resumes WHERE id = ? AND user_id = ?',
    args: [tailored.resume_id as string, userId],
  });
  const baseSource = (resumeRes.rows[0]?.source as string | undefined) ?? '';

  const scoreOriginal = calculateATSScore(baseSource, jdText).score;
  const scoreTailored = calculateATSScore((tailored.source as string) ?? '', jdText).score;

  await db.execute({
    sql: `UPDATE tailored_resumes
          SET is_public = 1,
              score_original = ?,
              score_tailored = ?,
              updated_at = unixepoch()
          WHERE id = ? AND user_id = ?`,
    args: [scoreOriginal, scoreTailored, tailoredId, userId],
  });

  revalidatePath(`/badge/${slug}`);
  return { slug };
}

export async function unpublishScore(tailoredId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to manage shares');

  const row = await db.execute({
    sql: 'SELECT share_slug FROM tailored_resumes WHERE id = ? AND user_id = ?',
    args: [tailoredId, userId],
  });
  const slug = row.rows[0]?.share_slug as string | null | undefined;

  await db.execute({
    sql: `UPDATE tailored_resumes
          SET is_public = 0, updated_at = unixepoch()
          WHERE id = ? AND user_id = ?`,
    args: [tailoredId, userId],
  });

  if (slug) revalidatePath(`/badge/${slug}`);
}

/**
 * Public read. No auth. Returns ONLY fields safe to expose:
 * cached scores and role. Never returns resume source, JD, company, or name.
 */
export async function getPublicScoreBySlug(slug: string): Promise<PublicScore | null> {
  if (!slug || typeof slug !== 'string' || !/^[a-f0-9]{8}$/.test(slug)) return null;

  const result = await db.execute({
    sql: `SELECT tr.score_original, tr.score_tailored, ja.role
          FROM tailored_resumes tr
          JOIN job_applications ja ON ja.id = tr.job_id
          WHERE tr.share_slug = ? AND tr.is_public = 1
          LIMIT 1`,
    args: [slug],
  });
  const row = result.rows[0];
  if (!row) return null;

  return {
    score_original: Number(row.score_original ?? 0),
    score_tailored: Number(row.score_tailored ?? 0),
    role: (row.role as string | null) ?? '',
  };
}

/**
 * Fetches the share state for a specific tailored resume (owner-scoped).
 * Used by the UI to know whether the "Share" button should show a
 * publish or unpublish affordance.
 */
export async function getShareStateForTailored(
  tailoredId: string,
): Promise<{ isPublic: boolean; slug: string | null }> {
  const userId = await getCurrentUserId();
  if (!userId) return { isPublic: false, slug: null };

  const result = await db.execute({
    sql: 'SELECT is_public, share_slug FROM tailored_resumes WHERE id = ? AND user_id = ?',
    args: [tailoredId, userId],
  });
  const row = result.rows[0];
  if (!row) return { isPublic: false, slug: null };

  return {
    isPublic: Number(row.is_public ?? 0) === 1,
    slug: (row.share_slug as string | null) ?? null,
  };
}
