import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { buildProofItemsForJob } from '@/lib/achievement-evidence';
import { db } from '@/lib/db';
import { isInternalWorkerRequest } from '@/lib/internal-route-auth';
import { parseJsonObjectInput } from '@/lib/json-route-input';
import {
  buildRecruiterReplyDraft,
  buildRecruiterReplyThreadKey,
  classifyRecruiterReply,
  extractReplyRoutingUserId,
  findBestRecruiterJobMatch,
  plainTextFromRawEmail,
  recruiterReplyRequestsProof,
  type InboundRecruiterEmail,
} from '@/lib/recruiter-reply-routing';
import type { AchievementEvidence, JobApplication } from '@/lib/types';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(req: Request) {
  if (!isInternalWorkerRequest(req.headers)) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseJsonObjectInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const email: InboundRecruiterEmail = {
    from: asString(parsed.body.from),
    to: asString(parsed.body.to),
    subject: asString(parsed.body.subject) || '(no subject)',
    text: asString(parsed.body.text) || plainTextFromRawEmail(asString(parsed.body.raw_text)),
    message_id: asString(parsed.body.message_id) || null,
    in_reply_to: asString(parsed.body.in_reply_to) || null,
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
  const proofRequested = recruiterReplyRequestsProof(email);
  const proofItems =
    proofRequested && match
      ? buildProofItemsForJob(
          await listAchievementEvidenceForReply(userId),
          match.job.role,
          match.job.jd_text,
          3
        ).map((item) => ({
          title: item.title,
          claim: item.claim,
          source_url: item.source_url,
        }))
      : [];
  const draft = buildRecruiterReplyDraft({
    classification: decision.classification,
    subject: email.subject,
    from: email.from,
    job: match?.job ?? null,
    proofRequested,
    proofItems,
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

async function listAchievementEvidenceForReply(userId: string): Promise<AchievementEvidence[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM achievement_evidence WHERE user_id = ? ORDER BY updated_at DESC',
    args: [userId],
  });
  return (JSON.parse(JSON.stringify(result.rows)) as Record<string, unknown>[]).map(
    toReplyEvidence
  );
}

function toReplyEvidence(row: Record<string, unknown>): AchievementEvidence {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    situation: String(row.situation ?? ''),
    action: String(row.action ?? ''),
    result: String(row.result ?? ''),
    metric: String(row.metric ?? ''),
    scope: String(row.scope ?? ''),
    skills: parseReplyJsonList(row.skills),
    role_targets: parseReplyJsonList(row.role_targets),
    impact_type: String(row.impact_type ?? 'other') as AchievementEvidence['impact_type'],
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
  };
}

function parseReplyJsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
