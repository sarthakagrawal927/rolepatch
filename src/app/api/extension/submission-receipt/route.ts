import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { inferAtsProvider, parseReadiness } from '@/lib/apply-agent';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { extensionCorsHeaders } from '@/lib/extension-cors';
import { parseExtensionSubmissionReceiptInput } from '@/lib/extension-route-input';
import type { ApplicationReceiptField } from '@/lib/types';

interface JobRow {
  id: string;
  url: string;
  resume_id: string | null;
}

interface QueueRow {
  id: string;
  readiness_json: string;
}

function profileCategoryForLabel(label: string): string {
  const lower = label.toLowerCase();
  if (/authorize|work auth|eligible to work|legally work/.test(lower)) return 'work_authorization';
  if (/sponsor|visa|h-?1b|work permit/.test(lower)) return 'sponsorship';
  if (/linkedin|github|portfolio|website|url|http|link/.test(lower)) return 'links';
  if (/location|city|state|country|remote|relocat/.test(lower)) return 'location';
  if (/salary|compensation|pay|rate/.test(lower)) return 'salary';
  if (/name|email|phone|pronoun/.test(lower)) return 'identity';
  return 'other';
}

function learnableSubmittedFields(fields: ApplicationReceiptField[]): ApplicationReceiptField[] {
  const seen = new Set<string>();
  return fields
    .filter((field) => {
      const label = field.label.trim();
      const value = field.value.trim();
      if (!label || !value) return false;
      if (/resume|cover letter|upload|file|attachment/i.test(label)) return false;
      const key = label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

async function learnProfileAnswersFromSubmittedFields(
  userId: string,
  submittedFields: ApplicationReceiptField[]
): Promise<number> {
  const fields = learnableSubmittedFields(submittedFields);
  let learned = 0;
  for (const field of fields) {
    const label = field.label.replace(/\s+/g, ' ').trim().slice(0, 160);
    const answer = field.value.replace(/\s+/g, ' ').trim().slice(0, 500);
    const existing = await db.execute({
      sql: 'SELECT id FROM profile_answers WHERE user_id = ? AND lower(label) = lower(?) LIMIT 1',
      args: [userId, label],
    });
    const existingId = existing.rows[0]?.id ? String(existing.rows[0].id) : null;
    if (existingId) {
      await db.execute({
        sql: `UPDATE profile_answers
              SET category = ?, answer = ?, sensitive = 1, updated_at = unixepoch()
              WHERE id = ? AND user_id = ?`,
        args: [profileCategoryForLabel(label), answer, existingId, userId],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO profile_answers (id, user_id, category, label, answer, sensitive)
              VALUES (?, ?, ?, ?, ?, 1)`,
        args: [uuid(), userId, profileCategoryForLabel(label), label, answer],
      });
    }
    learned++;
  }
  return learned;
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

  const parsed = parseExtensionSubmissionReceiptInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers });
  }
  const { jobId, originalUrl, confirmationUrl } = parsed.input;
  if (!jobId || !/^https?:\/\//i.test(confirmationUrl)) {
    return NextResponse.json(
      { ok: false, error: 'job_id and confirmation_url are required' },
      { status: 400, headers }
    );
  }

  const jobResult = await db.execute({
    sql: `SELECT id, url, resume_id
          FROM job_applications
          WHERE id = ? AND user_id = ?
          LIMIT 1`,
    args: [jobId, userId],
  });
  const job = JSON.parse(JSON.stringify(jobResult.rows[0] ?? null)) as JobRow | null;
  if (!job || (originalUrl && originalUrl !== job.url)) {
    return NextResponse.json({ ok: false, error: 'Tracked job not found' }, { status: 404, headers });
  }

  const [queueResult, coverLetterResult] = await Promise.all([
    db.execute({
      sql: 'SELECT id, readiness_json FROM application_queue WHERE job_id = ? AND user_id = ? LIMIT 1',
      args: [job.id, userId],
    }),
    db.execute({
      sql: 'SELECT id FROM cover_letters WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [job.id, userId],
    }),
  ]);
  const queue = JSON.parse(JSON.stringify(queueResult.rows[0] ?? null)) as QueueRow | null;
  const coverLetterId = (coverLetterResult.rows[0]?.id as string | undefined) ?? null;
  const confirmationText =
    parsed.input.confirmationText || 'Submission confirmation captured from the ATS page.';
  const failureReason = parsed.input.failureReason || null;
  const receiptStatus = parsed.input.status === 'failed' || failureReason ? 'failed' : 'submitted';
  const receiptId = uuid();
  const submittedFields = parsed.input.fields.map<ApplicationReceiptField>((field) => ({
    ...field,
    source: 'ats',
  }));
  const fields: ApplicationReceiptField[] = [
    {
      label: 'Submission mode',
      value: parsed.input.mode || 'User submitted after extension fill',
      source: 'user',
    },
    { label: 'Confirmation URL', value: confirmationUrl, source: 'ats' },
    { label: 'Confirmation text', value: confirmationText, source: 'ats' },
    ...(failureReason
      ? [{ label: 'Failure reason', value: failureReason, source: 'system' } satisfies ApplicationReceiptField]
      : []),
    ...submittedFields,
  ];

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
      parsed.input.provider || inferAtsProvider(job.url),
      receiptStatus,
      JSON.stringify(fields),
      job.resume_id,
      coverLetterId,
      confirmationText,
      confirmationUrl,
      failureReason,
    ],
  });

  if (receiptStatus === 'submitted') {
    await db.execute({
      sql: `UPDATE job_applications
            SET status = 'applied', updated_at = unixepoch()
            WHERE id = ? AND user_id = ?`,
      args: [job.id, userId],
    });
  }

  if (queue) {
    const readiness = parseReadiness(queue.readiness_json);
    await db.execute({
      sql: `UPDATE application_queue
            SET status = ?, readiness_json = ?, updated_at = unixepoch()
            WHERE id = ? AND user_id = ?`,
      args: [
        receiptStatus,
        JSON.stringify({
          ...readiness,
          status: receiptStatus,
          summary:
            receiptStatus === 'submitted'
              ? 'Application is submitted and has an ATS confirmation receipt.'
              : `Reviewed submit needs attention: ${failureReason ?? 'No ATS confirmation was detected.'}`,
          missing: receiptStatus === 'submitted' ? [] : ['Review the ATS page and submit manually if needed.'],
          checks: { ...readiness.checks, receipt: true },
        }),
        queue.id,
        userId,
      ],
    });
  }

  let learnedProfileAnswers = 0;
  if (receiptStatus === 'submitted' && submittedFields.length > 0) {
    try {
      learnedProfileAnswers = await learnProfileAnswersFromSubmittedFields(userId, submittedFields);
    } catch {
      learnedProfileAnswers = 0;
    }
  }

  return NextResponse.json(
    { ok: true, receipt_id: receiptId, learned_profile_answers: learnedProfileAnswers },
    { status: 200, headers }
  );
}
