import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { inferAtsProvider } from '@/lib/apply-agent';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { jobUrlVariants, sqlPlaceholders } from '@/lib/job-url';
import type { ApplicationReceiptField } from '@/lib/types';

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = origin.startsWith('chrome-extension://') ? origin : '*';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-rolepatch-session',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

interface FillReceiptRequest {
  url?: string;
  job_id?: string;
  filled?: number;
  detected?: number;
  skipped?: number;
  provider?: string;
  submit_detected?: boolean;
  upload_fields?: string[];
  uploaded_files?: string[];
  fields?: ApplicationReceiptField[];
  error?: string;
}

interface JobRow {
  id: string;
  url: string;
  resume_id: string | null;
}

interface QueueRow {
  id: string;
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  const authHeaders = new Headers(req.headers);
  const forwardedSession = req.headers.get('x-rolepatch-session');
  if (forwardedSession && !authHeaders.has('cookie')) {
    authHeaders.set('cookie', forwardedSession);
  }

  const userId = await getCurrentUserId(authHeaders);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers });
  }

  let payload: FillReceiptRequest;
  try {
    payload = (await req.json()) as FillReceiptRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers });
  }

  const url = (payload.url ?? '').trim();
  const jobId = (payload.job_id ?? '').trim();
  if (!/^https?:\/\//i.test(url) || !jobId) {
    return NextResponse.json(
      { ok: false, error: 'job_id and http(s) url are required' },
      { status: 400, headers }
    );
  }
  const urlVariants = jobUrlVariants(url);

  const jobResult = await db.execute({
    sql: `SELECT id, url, resume_id
          FROM job_applications
          WHERE id = ? AND url IN (${sqlPlaceholders(urlVariants)}) AND user_id = ?
          LIMIT 1`,
    args: [jobId, ...urlVariants, userId],
  });
  const job = JSON.parse(JSON.stringify(jobResult.rows[0] ?? null)) as JobRow | null;
  if (!job) {
    return NextResponse.json(
      { ok: false, error: 'Tracked job not found for this URL' },
      { status: 404, headers }
    );
  }

  const [queueResult, coverLetterResult] = await Promise.all([
    db.execute({
      sql: 'SELECT id FROM application_queue WHERE job_id = ? AND user_id = ? LIMIT 1',
      args: [job.id, userId],
    }),
    db.execute({
      sql: 'SELECT id FROM cover_letters WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [job.id, userId],
    }),
  ]);
  const queue = JSON.parse(JSON.stringify(queueResult.rows[0] ?? null)) as QueueRow | null;
  const coverLetterId = (coverLetterResult.rows[0]?.id as string | undefined) ?? null;
  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  const uploadFields = Array.isArray(payload.upload_fields)
    ? payload.upload_fields.filter((field) => typeof field === 'string' && field.trim()).slice(0, 12)
    : [];
  const uploadedFiles = Array.isArray(payload.uploaded_files)
    ? payload.uploaded_files.filter((field) => typeof field === 'string' && field.trim()).slice(0, 12)
    : [];
  const receiptFields: ApplicationReceiptField[] = [
    { label: 'Submission mode', value: 'Extension assisted fill', source: 'system' },
    { label: 'Detected provider', value: payload.provider || inferAtsProvider(job.url), source: 'system' },
    {
      label: 'Submit button detected',
      value: payload.submit_detected ? 'Yes' : 'No',
      source: 'system',
    },
    { label: 'Filled fields', value: String(payload.filled ?? 0), source: 'system' },
    { label: 'Detected fields', value: String(payload.detected ?? 0), source: 'system' },
    { label: 'Skipped fields', value: String(payload.skipped ?? 0), source: 'system' },
    {
      label: 'Manual file uploads needed',
      value: uploadFields.length > 0 ? uploadFields.join(' | ') : 'None detected',
      source: 'system',
    },
    {
      label: 'Files uploaded by extension',
      value: uploadedFiles.length > 0 ? uploadedFiles.join(' | ') : 'None',
      source: 'system',
    },
    ...fields.slice(0, 80),
  ];
  const receiptId = uuid();
  const failureReason = payload.error?.replace(/\s+/g, ' ').trim().slice(0, 800) || null;
  const receiptStatus = failureReason ? 'failed' : 'filled';
  const confirmationText = failureReason
    ? `Extension fill failed: ${failureReason}`
    : 'Fields filled by the RolePatch extension. User still needs to review and submit.';

  await db.execute({
    sql: `INSERT INTO application_receipts (
            id, job_id, queue_id, user_id, provider, status, fields_json, resume_id,
            cover_letter_id, confirmation_text, confirmation_url, failure_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      receiptId,
      job.id,
      queue?.id ?? null,
      userId,
      inferAtsProvider(job.url),
      receiptStatus,
      JSON.stringify(receiptFields),
      job.resume_id,
      coverLetterId,
      confirmationText,
      job.url,
      failureReason,
    ],
  });

  if (queue) {
    await db.execute({
      sql: `UPDATE application_queue
            SET status = ?, updated_at = unixepoch()
            WHERE id = ? AND user_id = ? AND status != 'submitted'`,
      args: [failureReason ? 'failed' : 'ready_to_submit', queue.id, userId],
    });
  }

  return NextResponse.json({ ok: true, receipt_id: receiptId }, { status: 200, headers });
}
