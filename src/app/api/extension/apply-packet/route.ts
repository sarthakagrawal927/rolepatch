import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { inferAtsProvider, normalizeReceipt } from '@/lib/apply-agent';
import { buildProofItemsForJob } from '@/lib/achievement-evidence';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { extensionCorsHeaders } from '@/lib/extension-cors';
import { parseExtensionUrlInput } from '@/lib/extension-route-input';
import { jobUrlVariants, sqlPlaceholders } from '@/lib/job-url';
import type { AchievementEvidence, ApplicationReceipt, ProfileAnswer } from '@/lib/types';

interface JobRow {
  id: string;
  url: string;
  company: string;
  role: string;
  jd_text: string;
  resume_id: string | null;
  resume_name: string | null;
}

interface MaterialRow {
  id: string;
  source?: string;
  content?: string;
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

function excerpt(value: string | null | undefined, max = 260): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}...` : cleaned;
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
    return NextResponse.json(
      { ok: false, error: 'Not authenticated', redirect_url: '/api/auth/signin' },
      { status: 401, headers }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers });
  }

  const parsed = parseExtensionUrlInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers });
  }
  const { url } = parsed.input;
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: 'url must be http(s)' }, { status: 400, headers });
  }
  const urlVariants = jobUrlVariants(url);

  const jobResult = await db.execute({
    sql: `SELECT j.id, j.url, j.company, j.role, j.jd_text, j.resume_id, r.name AS resume_name
          FROM job_applications j
          LEFT JOIN resumes r ON r.id = j.resume_id AND r.user_id = j.user_id
          WHERE j.url IN (${sqlPlaceholders(urlVariants)}) AND j.user_id = ?
          LIMIT 1`,
    args: [...urlVariants, userId],
  });
  const job = JSON.parse(JSON.stringify(jobResult.rows[0] ?? null)) as JobRow | null;
  if (!job) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Track this job in RolePatch before autofill.',
        redirect_url: '/dashboard',
      },
      { status: 404, headers }
    );
  }

  const [tailoredResult, coverResult, profileResult, receiptResult, evidenceResult] =
    await Promise.all([
      db.execute({
        sql: `SELECT id, source
            FROM tailored_resumes
            WHERE job_id = ? AND user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
        args: [job.id, userId],
      }),
      db.execute({
        sql: `SELECT id, content
            FROM cover_letters
            WHERE job_id = ? AND user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
        args: [job.id, userId],
      }),
      db.execute({
        sql: `SELECT id, category, label, answer, sensitive, created_at, updated_at
            FROM profile_answers
            WHERE user_id = ?
            ORDER BY updated_at DESC`,
        args: [userId],
      }),
      db.execute({
        sql: `SELECT id, job_id, queue_id, provider, status, fields_json, resume_id,
                   cover_letter_id, confirmation_text, confirmation_url, failure_reason, created_at
            FROM application_receipts
            WHERE job_id = ? AND user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
        args: [job.id, userId],
      }),
      db.execute({
        sql: 'SELECT * FROM achievement_evidence WHERE user_id = ? ORDER BY updated_at DESC',
        args: [userId],
      }),
    ]);

  const tailored = JSON.parse(JSON.stringify(tailoredResult.rows[0] ?? null)) as MaterialRow | null;
  const cover = JSON.parse(JSON.stringify(coverResult.rows[0] ?? null)) as MaterialRow | null;
  const profileAnswers = JSON.parse(JSON.stringify(profileResult.rows)) as ProfileAnswer[];
  const receiptRow = JSON.parse(JSON.stringify(receiptResult.rows[0] ?? null)) as ReceiptRow | null;
  const receipt = receiptRow
    ? normalizeReceipt({ ...receiptRow, fields: receiptRow.fields_json })
    : null;
  const proofItems = buildProofItemsForJob(
    (JSON.parse(JSON.stringify(evidenceResult.rows)) as Record<string, unknown>[]).map(
      toPacketEvidence
    ),
    job.role,
    job.jd_text,
    4
  ).map((item) => ({
    id: item.id,
    title: item.title,
    claim: item.claim,
    readiness: item.readiness.label,
    missing: item.readiness.missing,
    tags: item.tags,
    source_url: item.source_url,
  }));

  return NextResponse.json(
    {
      ok: true,
      packet: {
        job_id: job.id,
        company: job.company,
        role: job.role,
        ats_url: job.url,
        ats_provider: inferAtsProvider(job.url),
        resume_id: job.resume_id,
        resume_name: job.resume_name,
        tailored_resume_id: tailored?.id ?? null,
        tailored_resume_text: tailored?.source ?? null,
        tailored_excerpt: excerpt(tailored?.source),
        cover_letter_id: cover?.id ?? null,
        cover_letter_text: cover?.content ?? null,
        cover_letter_excerpt: excerpt(cover?.content),
        profile_answers: profileAnswers,
        proof_items: proofItems,
        receipt,
      },
    },
    { status: 200, headers }
  );
}

function toPacketEvidence(row: Record<string, unknown>): AchievementEvidence {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    situation: String(row.situation ?? ''),
    action: String(row.action ?? ''),
    result: String(row.result ?? ''),
    metric: String(row.metric ?? ''),
    scope: String(row.scope ?? ''),
    skills: parsePacketJsonList(row.skills),
    role_targets: parsePacketJsonList(row.role_targets),
    impact_type: String(row.impact_type ?? 'other') as AchievementEvidence['impact_type'],
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
  };
}

function parsePacketJsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}
