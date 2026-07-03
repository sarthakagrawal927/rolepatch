'use server';

import { revalidatePath } from 'next/cache';

import { buildApplyAgentReadiness } from '@/lib/apply-agent';
import {
  runGuardedApplyBrowserSubmitBatchForUser,
  runReviewedApplyBrowserCheckBatchForUser,
  runReviewedApplyBrowserCheckForUser,
  runGuardedApplyBrowserSubmitForUser,
} from '@/lib/apply-agent-browser-run';
import {
  bulkUpdateApplyAgentQueueStatusForUser,
  listApplyAgentPacketsForUser,
  listApplyAgentQueueForUser,
  listApplyAgentReceiptsForUser,
  queueApplyAgentApplicationForUser,
  recordApplyAgentManualReceiptForUser,
  retryApplyAgentQueueEntryForUser,
  updateApplyAgentQueueStatusForUser,
} from '@/lib/apply-agent-api';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import type {
  ApplicationPacket,
  ApplicationQueueEntry,
  ApplicationQueueStatus,
  ApplicationReceipt,
  GuardedBrowserSubmitBatchResult,
  GuardedBrowserSubmitResult,
  JobApplication,
  ReviewedBrowserCheckResult,
  ReviewedBrowserCheckBatchResult,
} from '@/lib/types';

interface JobReadinessRow {
  id: string;
  resume_id: string | null;
  url: string;
  status: JobApplication['status'];
  tailored_count: number;
  cover_letter_count: number;
  receipt_count: number;
  profile_answer_count: number;
}

async function getReadinessRows(userId: string, jobIds?: string[]): Promise<JobReadinessRow[]> {
  const args: string[] = [userId];
  const jobFilter =
    jobIds && jobIds.length > 0
      ? `AND j.id IN (${jobIds
          .map((id) => {
            args.push(id);
            return '?';
          })
          .join(', ')})`
      : '';

  const result = await db.execute({
    sql: `SELECT
            j.id,
            j.resume_id,
            j.url,
            j.status,
            COUNT(DISTINCT tr.id) AS tailored_count,
            COUNT(DISTINCT cl.id) AS cover_letter_count,
            COUNT(DISTINCT ar.id) AS receipt_count
          FROM job_applications j
          LEFT JOIN tailored_resumes tr ON tr.job_id = j.id AND tr.user_id = j.user_id
          LEFT JOIN cover_letters cl ON cl.job_id = j.id AND cl.user_id = j.user_id
          LEFT JOIN application_receipts ar ON ar.job_id = j.id AND ar.user_id = j.user_id
          WHERE j.user_id = ? ${jobFilter}
          GROUP BY j.id, j.resume_id, j.url, j.status`,
    args,
  });
  const profileResult = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM profile_answers WHERE user_id = ?',
    args: [userId],
  });
  const profileAnswerCount = Number(profileResult.rows[0]?.count ?? 0);
  return (
    JSON.parse(JSON.stringify(result.rows)) as Omit<JobReadinessRow, 'profile_answer_count'>[]
  ).map((row) => ({ ...row, profile_answer_count: profileAnswerCount }));
}

function readinessForRow(row: JobReadinessRow) {
  return buildApplyAgentReadiness({
    jobStatus: row.status,
    hasResume: Boolean(row.resume_id),
    hasTailoredResume: row.status === 'tailored' || Number(row.tailored_count) > 0,
    hasCoverLetter: Number(row.cover_letter_count) > 0,
    hasProfileAnswers: Number(row.profile_answer_count) > 0,
    hasReceipt: Number(row.receipt_count) > 0,
  });
}

export async function listApplicationQueue(): Promise<ApplicationQueueEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return listApplyAgentQueueForUser(userId);
}

export async function listApplicationReceipts(jobIds?: string[]): Promise<ApplicationReceipt[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return listApplyAgentReceiptsForUser(userId, jobIds);
}

export async function listApplicationPackets(jobIds?: string[]): Promise<ApplicationPacket[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return listApplyAgentPacketsForUser(userId, jobIds);
}

export async function queueApplication(jobId: string): Promise<ApplicationQueueEntry> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to queue applications');

  const entry = await queueApplyAgentApplicationForUser(userId, jobId);
  revalidatePath('/dashboard');
  return entry;
}

export async function refreshApplicationQueueReadiness(): Promise<ApplicationQueueEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const rows = await getReadinessRows(userId);
  for (const row of rows) {
    await db.execute({
      sql: `UPDATE application_queue
            SET readiness_json = ?, updated_at = unixepoch()
            WHERE job_id = ? AND user_id = ?`,
      args: [JSON.stringify(readinessForRow(row)), row.id, userId],
    });
  }
  revalidatePath('/dashboard');
  return listApplicationQueue();
}

export async function updateApplicationQueueStatus(
  queueId: string,
  status: ApplicationQueueStatus
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update application queue');
  await updateApplyAgentQueueStatusForUser(userId, queueId, status);
  revalidatePath('/dashboard');
}

export async function bulkUpdateApplicationQueueStatus(
  queueIds: string[],
  status: ApplicationQueueStatus
): Promise<ApplicationQueueEntry[]> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to update application queue');
  const entries = await bulkUpdateApplyAgentQueueStatusForUser(userId, queueIds, status);
  revalidatePath('/dashboard');
  return entries;
}

export async function retryApplicationQueueEntry(queueId: string): Promise<ApplicationQueueEntry> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to retry applications');
  const entry = await retryApplyAgentQueueEntryForUser(userId, queueId);
  revalidatePath('/dashboard');
  return entry;
}

export async function recordManualApplicationReceipt(input: {
  queueId: string;
  confirmationText?: string;
  confirmationUrl?: string;
}): Promise<ApplicationReceipt> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to record receipts');

  const receipt = await recordApplyAgentManualReceiptForUser(userId, input);
  revalidatePath('/dashboard');
  return receipt;
}

export async function runReviewedBrowserCheck(
  queueId: string
): Promise<ReviewedBrowserCheckResult> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to run browser checks');
  const result = await runReviewedApplyBrowserCheckForUser(userId, queueId);
  revalidatePath('/dashboard');
  return result;
}

export async function runReviewedBrowserCheckBatch(
  queueIds: string[]
): Promise<ReviewedBrowserCheckBatchResult> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to run browser checks');
  const result = await runReviewedApplyBrowserCheckBatchForUser(userId, {
    queueIds,
    limit: queueIds.length || 5,
  });
  revalidatePath('/dashboard');
  return result;
}

export async function runGuardedBrowserSubmit(
  queueId: string
): Promise<GuardedBrowserSubmitResult> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to run guarded submit');
  const result = await runGuardedApplyBrowserSubmitForUser(userId, queueId);
  revalidatePath('/dashboard');
  return result;
}

export async function runGuardedBrowserSubmitBatch(
  queueIds: string[]
): Promise<GuardedBrowserSubmitBatchResult> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to run guarded submit');
  const result = await runGuardedApplyBrowserSubmitBatchForUser(userId, {
    queueIds,
    limit: queueIds.length || 3,
  });
  revalidatePath('/dashboard');
  return result;
}
