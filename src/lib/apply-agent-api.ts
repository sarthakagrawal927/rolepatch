import { v4 as uuid } from 'uuid';

import {
  APPLICATION_QUEUE_STATUSES,
  buildApplyAgentReadiness,
  inferAtsProvider,
  normalizeQueueEntry,
  normalizeReceipt,
  parseReadiness,
} from '@/lib/apply-agent';
import { db } from '@/lib/db';
import type {
  ApplicationPacket,
  ApplicationQueueEntry,
  ApplicationQueueStatus,
  ApplicationReceipt,
  ApplicationReceiptField,
  JobApplication,
  ProfileAnswer,
} from '@/lib/types';

interface QueueRow {
  id: string;
  job_id: string;
  status: ApplicationQueueStatus;
  readiness_json: string;
  created_at: number;
  updated_at: number;
}

interface ReceiptRow {
  id: string;
  job_id: string;
  queue_id: string | null;
  provider: string;
  status: ApplicationReceipt['status'];
  fields_json: string;
  resume_id: string | null;
  cover_letter_id: string | null;
  confirmation_text: string | null;
  confirmation_url: string | null;
  failure_reason: string | null;
  created_at: number;
}

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

interface PacketJobRow {
  id: string;
  url: string;
  resume_id: string | null;
  resume_name: string | null;
}

interface PacketTailoredRow {
  id: string;
  job_id: string;
  source: string;
}

interface PacketCoverLetterRow {
  id: string;
  job_id: string;
  content: string;
}

function excerpt(value: string | null | undefined, max = 220): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}...` : cleaned;
}

function toQueueEntry(row: QueueRow): ApplicationQueueEntry {
  return normalizeQueueEntry({
    id: row.id,
    job_id: row.job_id,
    status: row.status,
    readiness: row.readiness_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function toReceipt(row: ReceiptRow): ApplicationReceipt {
  return normalizeReceipt({
    id: row.id,
    job_id: row.job_id,
    queue_id: row.queue_id,
    provider: row.provider,
    status: row.status,
    fields: row.fields_json,
    resume_id: row.resume_id,
    cover_letter_id: row.cover_letter_id,
    confirmation_text: row.confirmation_text,
    confirmation_url: row.confirmation_url,
    failure_reason: row.failure_reason,
    created_at: row.created_at,
  });
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

export async function listApplyAgentQueueForUser(userId: string): Promise<ApplicationQueueEntry[]> {
  const result = await db.execute({
    sql: 'SELECT id, job_id, status, readiness_json, created_at, updated_at FROM application_queue WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return (JSON.parse(JSON.stringify(result.rows)) as QueueRow[]).map(toQueueEntry);
}

export async function listApplyAgentReceiptsForUser(
  userId: string,
  jobIds?: string[]
): Promise<ApplicationReceipt[]> {
  const args: string[] = [userId];
  const jobFilter =
    jobIds && jobIds.length > 0
      ? `AND job_id IN (${jobIds
          .map((id) => {
            args.push(id);
            return '?';
          })
          .join(', ')})`
      : '';
  const result = await db.execute({
    sql: `SELECT id, job_id, queue_id, provider, status, fields_json, resume_id, cover_letter_id, confirmation_text, confirmation_url, failure_reason, created_at
          FROM application_receipts
          WHERE user_id = ? ${jobFilter}
          ORDER BY created_at DESC`,
    args,
  });
  return (JSON.parse(JSON.stringify(result.rows)) as ReceiptRow[]).map(toReceipt);
}

export async function listApplyAgentPacketsForUser(
  userId: string,
  jobIds?: string[]
): Promise<ApplicationPacket[]> {
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

  const [jobResult, tailoredResult, coverResult, receipts, profileResult] = await Promise.all([
    db.execute({
      sql: `SELECT j.id, j.url, j.resume_id, r.name AS resume_name
            FROM job_applications j
            LEFT JOIN resumes r ON r.id = j.resume_id AND r.user_id = j.user_id
            WHERE j.user_id = ? ${jobFilter}
            ORDER BY j.updated_at DESC`,
      args,
    }),
    db.execute({
      sql: `SELECT tr.id, tr.job_id, tr.source
            FROM tailored_resumes tr
            JOIN (
              SELECT job_id, MAX(created_at) AS created_at
              FROM tailored_resumes
              WHERE user_id = ?
              GROUP BY job_id
            ) latest ON latest.job_id = tr.job_id AND latest.created_at = tr.created_at
            WHERE tr.user_id = ?`,
      args: [userId, userId],
    }),
    db.execute({
      sql: `SELECT cl.id, cl.job_id, cl.content
            FROM cover_letters cl
            JOIN (
              SELECT job_id, MAX(created_at) AS created_at
              FROM cover_letters
              WHERE user_id = ?
              GROUP BY job_id
            ) latest ON latest.job_id = cl.job_id AND latest.created_at = cl.created_at
            WHERE cl.user_id = ?`,
      args: [userId, userId],
    }),
    listApplyAgentReceiptsForUser(userId, jobIds),
    db.execute({
      sql: 'SELECT id, category, label, answer, sensitive, created_at, updated_at FROM profile_answers WHERE user_id = ? ORDER BY updated_at DESC',
      args: [userId],
    }),
  ]);

  const tailoredByJob = new Map(
    (JSON.parse(JSON.stringify(tailoredResult.rows)) as PacketTailoredRow[]).map((row) => [
      row.job_id,
      row,
    ])
  );
  const coverByJob = new Map(
    (JSON.parse(JSON.stringify(coverResult.rows)) as PacketCoverLetterRow[]).map((row) => [
      row.job_id,
      row,
    ])
  );
  const receiptByJob = new Map(receipts.map((receipt) => [receipt.job_id, receipt]));
  const profileAnswers = JSON.parse(JSON.stringify(profileResult.rows)) as ProfileAnswer[];

  return (JSON.parse(JSON.stringify(jobResult.rows)) as PacketJobRow[]).map((job) => {
    const tailored = tailoredByJob.get(job.id);
    const cover = coverByJob.get(job.id);
    return {
      job_id: job.id,
      ats_url: job.url,
      ats_provider: inferAtsProvider(job.url),
      resume_id: job.resume_id,
      resume_name: job.resume_name,
      tailored_resume_id: tailored?.id ?? null,
      tailored_excerpt: excerpt(tailored?.source),
      cover_letter_id: cover?.id ?? null,
      cover_letter_excerpt: excerpt(cover?.content),
      profile_answers: profileAnswers,
      receipt: receiptByJob.get(job.id) ?? null,
    };
  });
}

export async function queueApplyAgentApplicationForUser(
  userId: string,
  jobId: string
): Promise<ApplicationQueueEntry> {
  const rows = await getReadinessRows(userId, [jobId]);
  const row = rows[0];
  if (!row) throw new Error('Job not found');
  const readiness = readinessForRow(row);
  const id = uuid();

  await db.execute({
    sql: `INSERT INTO application_queue (id, job_id, user_id, status, readiness_json)
          VALUES (?, ?, ?, 'queued', ?)
          ON CONFLICT(user_id, job_id) DO UPDATE SET
            readiness_json = excluded.readiness_json,
            updated_at = unixepoch()`,
    args: [id, jobId, userId, JSON.stringify(readiness)],
  });

  const result = await db.execute({
    sql: 'SELECT id, job_id, status, readiness_json, created_at, updated_at FROM application_queue WHERE job_id = ? AND user_id = ? LIMIT 1',
    args: [jobId, userId],
  });
  return toQueueEntry(JSON.parse(JSON.stringify(result.rows[0])) as QueueRow);
}

export async function updateApplyAgentQueueStatusForUser(
  userId: string,
  queueId: string,
  status: ApplicationQueueStatus
): Promise<ApplicationQueueEntry> {
  if (!APPLICATION_QUEUE_STATUSES.includes(status)) {
    throw new Error(`Invalid queue status: ${status}`);
  }
  await db.execute({
    sql: 'UPDATE application_queue SET status = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?',
    args: [status, queueId, userId],
  });
  const result = await db.execute({
    sql: 'SELECT id, job_id, status, readiness_json, created_at, updated_at FROM application_queue WHERE id = ? AND user_id = ? LIMIT 1',
    args: [queueId, userId],
  });
  if (!result.rows[0]) throw new Error('Queued application not found');
  return toQueueEntry(JSON.parse(JSON.stringify(result.rows[0])) as QueueRow);
}

export async function bulkUpdateApplyAgentQueueStatusForUser(
  userId: string,
  queueIds: string[],
  status: ApplicationQueueStatus
): Promise<ApplicationQueueEntry[]> {
  if (!APPLICATION_QUEUE_STATUSES.includes(status)) {
    throw new Error(`Invalid queue status: ${status}`);
  }
  const ids = [...new Set(queueIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) throw new Error('At least one queue id is required');

  const placeholders = ids.map(() => '?').join(', ');
  await db.execute({
    sql: `UPDATE application_queue
          SET status = ?, updated_at = unixepoch()
          WHERE user_id = ? AND id IN (${placeholders})`,
    args: [status, userId, ...ids],
  });

  const result = await db.execute({
    sql: `SELECT id, job_id, status, readiness_json, created_at, updated_at
          FROM application_queue
          WHERE user_id = ? AND id IN (${placeholders})
          ORDER BY updated_at DESC`,
    args: [userId, ...ids],
  });
  return (JSON.parse(JSON.stringify(result.rows)) as QueueRow[]).map(toQueueEntry);
}

export async function retryApplyAgentQueueEntryForUser(
  userId: string,
  queueId: string
): Promise<ApplicationQueueEntry> {
  const queueResult = await db.execute({
    sql: 'SELECT id, job_id, status, readiness_json, created_at, updated_at FROM application_queue WHERE id = ? AND user_id = ? LIMIT 1',
    args: [queueId, userId],
  });
  const queue = JSON.parse(JSON.stringify(queueResult.rows[0] ?? null)) as QueueRow | null;
  if (!queue) throw new Error('Queued application not found');
  if (queue.status === 'submitted') throw new Error('Submitted applications cannot be retried');

  const rows = await getReadinessRows(userId, [queue.job_id]);
  const row = rows[0];
  if (!row) throw new Error('Job not found');
  const readiness = readinessForRow(row);
  if (readiness.status === 'submitted') throw new Error('Submitted applications cannot be retried');
  const status: ApplicationQueueStatus =
    readiness.status === 'ready_for_review' ? 'ready_to_submit' : 'needs_user';

  await db.execute({
    sql: 'UPDATE application_queue SET status = ?, readiness_json = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?',
    args: [status, JSON.stringify(readiness), queueId, userId],
  });

  const result = await db.execute({
    sql: 'SELECT id, job_id, status, readiness_json, created_at, updated_at FROM application_queue WHERE id = ? AND user_id = ? LIMIT 1',
    args: [queueId, userId],
  });
  if (!result.rows[0]) throw new Error('Queued application not found');
  return toQueueEntry(JSON.parse(JSON.stringify(result.rows[0])) as QueueRow);
}

export async function recordApplyAgentManualReceiptForUser(
  userId: string,
  input: { queueId: string; confirmationText?: string; confirmationUrl?: string }
): Promise<ApplicationReceipt> {
  const queueResult = await db.execute({
    sql: `SELECT q.id, q.job_id, q.readiness_json, j.url, j.resume_id
          FROM application_queue q
          JOIN job_applications j ON j.id = q.job_id AND j.user_id = q.user_id
          WHERE q.id = ? AND q.user_id = ?
          LIMIT 1`,
    args: [input.queueId, userId],
  });
  const queue = queueResult.rows[0] as
    | {
        id: string;
        job_id: string;
        readiness_json: string;
        url: string;
        resume_id: string | null;
      }
    | undefined;
  if (!queue) throw new Error('Queued application not found');

  const coverLetterResult = await db.execute({
    sql: 'SELECT id FROM cover_letters WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [queue.job_id, userId],
  });
  const coverLetterId = (coverLetterResult.rows[0]?.id as string | undefined) ?? null;
  const profileAnswersResult = await db.execute({
    sql: 'SELECT label, answer FROM profile_answers WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  const profileFields = (
    JSON.parse(JSON.stringify(profileAnswersResult.rows)) as Array<{
      label: string;
      answer: string;
    }>
  ).map<ApplicationReceiptField>((answer) => ({
    label: answer.label,
    value: answer.answer,
    source: 'profile',
  }));
  const receiptId = uuid();
  const fields: ApplicationReceiptField[] = [
    { label: 'Submission mode', value: 'API manual confirmation', source: 'user' },
    {
      label: 'Readiness at submission',
      value: parseReadiness(queue.readiness_json).summary,
      source: 'system',
    },
    ...profileFields,
  ];

  await db.execute({
    sql: `INSERT INTO application_receipts (
            id, job_id, queue_id, user_id, provider, status, fields_json, resume_id, cover_letter_id,
            confirmation_text, confirmation_url
          )
          VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?)`,
    args: [
      receiptId,
      queue.job_id,
      queue.id,
      userId,
      inferAtsProvider(queue.url),
      JSON.stringify(fields),
      queue.resume_id,
      coverLetterId,
      input.confirmationText?.trim() || 'Marked submitted through the RolePatch apply-agent API.',
      input.confirmationUrl?.trim() || null,
    ],
  });
  await db.execute({
    sql: `UPDATE job_applications SET status = 'applied', updated_at = unixepoch() WHERE id = ? AND user_id = ? AND status IN ('draft', 'tailored')`,
    args: [queue.job_id, userId],
  });
  const readinessRows = await getReadinessRows(userId, [queue.job_id]);
  const readiness = readinessRows[0]
    ? readinessForRow(readinessRows[0])
    : parseReadiness(queue.readiness_json);
  await db.execute({
    sql: `UPDATE application_queue
          SET status = 'submitted', readiness_json = ?, updated_at = unixepoch()
          WHERE id = ? AND user_id = ?`,
    args: [JSON.stringify(readiness), queue.id, userId],
  });

  const result = await db.execute({
    sql: `SELECT id, job_id, queue_id, provider, status, fields_json, resume_id, cover_letter_id, confirmation_text, confirmation_url, failure_reason, created_at
          FROM application_receipts
          WHERE id = ? AND user_id = ?
          LIMIT 1`,
    args: [receiptId, userId],
  });
  return toReceipt(JSON.parse(JSON.stringify(result.rows[0])) as ReceiptRow);
}
