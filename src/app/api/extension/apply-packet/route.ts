import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { inferAtsProvider, normalizeReceipt } from '@/lib/apply-agent';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { jobUrlVariants, sqlPlaceholders } from '@/lib/job-url';
import type { ApplicationReceipt, ProfileAnswer } from '@/lib/types';

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

interface PacketRequest {
  url?: string;
}

interface JobRow {
  id: string;
  url: string;
  company: string;
  role: string;
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
    return NextResponse.json(
      { ok: false, error: 'Not authenticated', redirect_url: '/api/auth/signin' },
      { status: 401, headers }
    );
  }

  let payload: PacketRequest;
  try {
    payload = (await req.json()) as PacketRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers });
  }

  const url = (payload.url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: 'url must be http(s)' }, { status: 400, headers });
  }
  const urlVariants = jobUrlVariants(url);

  const jobResult = await db.execute({
    sql: `SELECT j.id, j.url, j.company, j.role, j.resume_id, r.name AS resume_name
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

  const [tailoredResult, coverResult, profileResult, receiptResult] = await Promise.all([
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
  ]);

  const tailored = JSON.parse(JSON.stringify(tailoredResult.rows[0] ?? null)) as MaterialRow | null;
  const cover = JSON.parse(JSON.stringify(coverResult.rows[0] ?? null)) as MaterialRow | null;
  const profileAnswers = JSON.parse(JSON.stringify(profileResult.rows)) as ProfileAnswer[];
  const receiptRow = JSON.parse(JSON.stringify(receiptResult.rows[0] ?? null)) as ReceiptRow | null;
  const receipt = receiptRow
    ? normalizeReceipt({ ...receiptRow, fields: receiptRow.fields_json })
    : null;

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
        receipt,
      },
    },
    { status: 200, headers }
  );
}
