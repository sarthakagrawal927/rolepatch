'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import {
  buildRecruiterReplyDraft,
  buildReplyRoutingAddress,
  normalizeEmailThreadSubject,
} from '@/lib/recruiter-reply-routing';
import type { RecruiterReplyEvent } from '@/lib/types';

interface RecruiterReplyEventRow
  extends Omit<
    RecruiterReplyEvent,
    | 'applied_status'
    | 'thread_key'
    | 'suggested_reply_subject'
    | 'suggested_reply_body'
    | 'reply_sent_at'
    | 'reply_sent_subject'
    | 'reply_sent_body'
    | 'reply_send_error'
  > {
  applied_status: string | null;
  in_reply_to: string | null;
  thread_key?: string | null;
  suggested_reply_subject?: string | null;
  suggested_reply_body?: string | null;
  reply_sent_at?: number | null;
  reply_sent_subject?: string | null;
  reply_sent_body?: string | null;
  reply_send_error?: string | null;
}

const VALID_JOB_STATUSES = new Set([
  'draft',
  'tailored',
  'applied',
  'interview',
  'offer',
  'rejected',
]);

export async function getReplyRoutingAddress(): Promise<string | null> {
  const userId = await getCurrentUserId();
  return userId ? buildReplyRoutingAddress(userId) : null;
}

export async function listRecruiterReplyEvents(): Promise<RecruiterReplyEvent[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const result = await db.execute({
    sql: `SELECT id, job_id, from_email, to_email, subject, classification,
                 applied_status, summary, message_id, in_reply_to, thread_key,
                 suggested_reply_subject, suggested_reply_body, reply_sent_at,
                 reply_sent_subject, reply_sent_body, reply_send_error, created_at
          FROM recruiter_reply_events
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 12`,
    args: [userId],
  });
  return (JSON.parse(JSON.stringify(result.rows)) as RecruiterReplyEventRow[]).map((row) => {
    const draft = buildRecruiterReplyDraft({
      classification: row.classification,
      subject: row.subject,
      from: row.from_email,
      job: null,
    });
    return {
      ...row,
      applied_status: VALID_JOB_STATUSES.has(row.applied_status ?? '')
        ? (row.applied_status as RecruiterReplyEvent['applied_status'])
        : null,
      in_reply_to: row.in_reply_to ?? null,
      thread_key:
        row.thread_key ||
        `subject:${row.from_email.split('@')[1] ?? 'unknown'}:${normalizeEmailThreadSubject(row.subject)}`,
      suggested_reply_subject: row.suggested_reply_subject || draft.subject,
      suggested_reply_body: row.suggested_reply_body || draft.body,
      reply_sent_at: row.reply_sent_at ?? null,
      reply_sent_subject: row.reply_sent_subject || null,
      reply_sent_body: row.reply_sent_body || null,
      reply_send_error: row.reply_send_error || null,
    };
  });
}

interface RecruiterReplySendRow {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  suggested_reply_subject: string | null;
  suggested_reply_body: string | null;
}

export interface SendRecruiterReplyResult {
  ok: boolean;
  sent: boolean;
  skipped?: boolean;
  error?: string;
  reply_sent_at?: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendRecruiterReply(
  eventId: string,
  subject: string,
  body: string
): Promise<SendRecruiterReplyResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, sent: false, error: 'Sign in to send replies.' };

  const cleanEventId = eventId.trim();
  const cleanSubject = subject.replace(/\s+/g, ' ').trim().slice(0, 200);
  const cleanBody = body.replace(/\r\n/g, '\n').trim().slice(0, 6000);
  if (!cleanEventId || !cleanSubject || !cleanBody) {
    return { ok: false, sent: false, error: 'Reply subject and body are required.' };
  }

  const result = await db.execute({
    sql: `SELECT id, from_email, to_email, subject, suggested_reply_subject, suggested_reply_body
          FROM recruiter_reply_events
          WHERE id = ? AND user_id = ?
          LIMIT 1`,
    args: [cleanEventId, userId],
  });
  const event = JSON.parse(JSON.stringify(result.rows[0] ?? null)) as RecruiterReplySendRow | null;
  if (!event) return { ok: false, sent: false, error: 'Recruiter reply not found.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.from_email)) {
    return { ok: false, sent: false, error: 'Recruiter email address is invalid.' };
  }

  const sendResult = await sendEmail({
    to: event.from_email,
    subject: cleanSubject,
    text: cleanBody,
    html: `<p>${escapeHtml(cleanBody).replaceAll('\n', '<br />')}</p>`,
    replyTo: event.to_email || buildReplyRoutingAddress(userId),
  });

  if (!sendResult.sent) {
    const error = sendResult.skipped
      ? 'Outbound email is not configured. Set RESEND_API_KEY before sending recruiter replies.'
      : sendResult.error || 'Could not send recruiter reply.';
    await db.execute({
      sql: `UPDATE recruiter_reply_events
            SET reply_send_error = ?
            WHERE id = ? AND user_id = ?`,
      args: [error, event.id, userId],
    });
    revalidatePath('/dashboard');
    return { ok: false, sent: false, skipped: sendResult.skipped, error };
  }

  const now = Math.floor(Date.now() / 1000);
  await db.execute({
    sql: `UPDATE recruiter_reply_events
          SET reply_sent_at = ?, reply_sent_subject = ?, reply_sent_body = ?, reply_send_error = ''
          WHERE id = ? AND user_id = ?`,
    args: [now, cleanSubject, cleanBody, event.id, userId],
  });
  revalidatePath('/dashboard');
  return { ok: true, sent: true, reply_sent_at: now };
}
