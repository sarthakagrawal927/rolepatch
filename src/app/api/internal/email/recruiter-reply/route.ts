import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { db } from '@/lib/db';
import {
  buildRecruiterReplyDraft,
  buildRecruiterReplyThreadKey,
  classifyRecruiterReply,
  extractReplyRoutingUserId,
  findBestRecruiterJobMatch,
  plainTextFromRawEmail,
  type InboundRecruiterEmail,
} from '@/lib/recruiter-reply-routing';
import type { JobApplication } from '@/lib/types';

interface InboundReplyPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  raw_text?: string;
  message_id?: string | null;
  in_reply_to?: string | null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  let body: InboundReplyPayload;
  try {
    body = (await req.json()) as InboundReplyPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const email: InboundRecruiterEmail = {
    from: asString(body.from),
    to: asString(body.to),
    subject: asString(body.subject) || '(no subject)',
    text: asString(body.text) || plainTextFromRawEmail(asString(body.raw_text)),
    message_id: asString(body.message_id) || null,
    in_reply_to: asString(body.in_reply_to) || null,
  };
  if (!email.from || !email.to) {
    return NextResponse.json({ ok: false, error: 'from and to are required' }, { status: 400 });
  }

  const userId = extractReplyRoutingUserId(email.to);
  if (!userId) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'unknown-routing-address' });
  }

  const user = await db.execute({
    sql: 'SELECT id FROM users WHERE id = ? LIMIT 1',
    args: [userId],
  });
  if (user.rows.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'unknown-user' });
  }

  const jobRows = await db.execute({
    sql: `SELECT * FROM job_applications
          WHERE user_id = ?
          ORDER BY updated_at DESC
          LIMIT 100`,
    args: [userId],
  });
  const jobs = JSON.parse(JSON.stringify(jobRows.rows)) as JobApplication[];
  const match = findBestRecruiterJobMatch(email, jobs);
  const decision = classifyRecruiterReply(email);
  const threadKey = buildRecruiterReplyThreadKey(email);
  const draft = buildRecruiterReplyDraft({
    classification: decision.classification,
    subject: email.subject,
    from: email.from,
    job: match?.job ?? null,
  });

  const eventId = uuid();
  await db.execute({
    sql: `INSERT INTO recruiter_reply_events
          (id, user_id, job_id, from_email, to_email, subject, classification,
           applied_status, summary, message_id, in_reply_to, thread_key,
           suggested_reply_subject, suggested_reply_body)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      eventId,
      userId,
      match?.job.id ?? null,
      email.from,
      email.to,
      email.subject,
      decision.classification,
      match && decision.status ? decision.status : null,
      match
        ? `${decision.summary} Matched ${match.job.company} / ${match.job.role}.`
        : `${decision.summary} No tracked application was confidently matched.`,
      email.message_id ?? null,
      email.in_reply_to ?? null,
      threadKey,
      draft.subject,
      draft.body,
    ],
  });

  if (match && decision.status) {
    await db.execute({
      sql: `UPDATE job_applications
            SET status = ?, updated_at = unixepoch(),
                rejection_reason = CASE WHEN ? = 'rejected' THEN ? ELSE rejection_reason END
            WHERE id = ? AND user_id = ?`,
      args: [
        decision.status,
        decision.status,
        decision.classification === 'rejected' ? email.subject : null,
        match.job.id,
        userId,
      ],
    });
  }

  await db.execute({
    sql: `INSERT INTO job_discovery_alerts (id, user_id, alert_type, title, detail)
          VALUES (?, ?, 'reply_routed', ?, ?)`,
    args: [
      uuid(),
      userId,
      match ? `Recruiter reply: ${decision.classification}` : 'Recruiter reply needs review',
      match ? `${match.job.company} · ${email.subject}` : `${email.from} · ${email.subject}`,
    ],
  });

  return NextResponse.json({
    ok: true,
    event_id: eventId,
    matched_job_id: match?.job.id ?? null,
    classification: decision.classification,
    applied_status: match && decision.status ? decision.status : null,
  });
}
