import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { inferAtsProvider } from '@/lib/apply-agent';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { extensionCorsHeaders } from '@/lib/extension-cors';
import { parseExtensionFillReceiptInput } from '@/lib/extension-route-input';
import { jobUrlVariants, sqlPlaceholders } from '@/lib/job-url';
import type { ApplicationReceiptField } from '@/lib/types';

interface JobRow {
  id: string;
  url: string;
  resume_id: string | null;
}

interface QueueRow {
  id: string;
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: extensionCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const headers = extensionCorsHeaders(req);
  const authHeaders = new Headers(req.headers);
  const forwardedSession = req.headers.get('x-rolepatch-session');
  if (forwardedSession && !authHeaders.has('cookie')) {
    authHeaders.set('cookie', forwardedSession);
  }

  const userId = await getCurrentUserId(authHeaders);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers });
  }

  const parsed = parseExtensionFillReceiptInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers });
  }
  const { url, jobId } = parsed.input;
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
  const { fields, uploadFields, uploadedFiles } = parsed.input;
  const receiptFields: ApplicationReceiptField[] = [
    { label: 'Submission mode', value: 'Extension assisted fill', source: 'system' },
    {
      label: 'Detected provider',
      value: parsed.input.provider || inferAtsProvider(job.url),
      source: 'system',
    },
    {
      label: 'Submit button detected',
      value: parsed.input.submitDetected ? 'Yes' : 'No',
      source: 'system',
    },
    { label: 'Filled fields', value: String(parsed.input.filled), source: 'system' },
    { label: 'Detected fields', value: String(parsed.input.detected), source: 'system' },
    { label: 'Skipped fields', value: String(parsed.input.skipped), source: 'system' },
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
    ...fields,
  ];
  const receiptId = uuid();
  const failureReason = parsed.input.error || null;
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
