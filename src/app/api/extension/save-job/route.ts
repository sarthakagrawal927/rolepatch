import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { queueApplyAgentApplicationForUser } from '@/lib/apply-agent-api';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { canonicalJobUrl, jobUrlVariants, sqlPlaceholders } from '@/lib/job-url';

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

interface SaveJobPayload {
  url?: string;
  title?: string;
  company?: string;
  jd_text?: string;
  queue?: boolean;
}

function extractCompanyFromUrl(url: string, titleFallback: string): string {
  const greenhouse = url.match(/boards\.greenhouse\.io\/([^/]+)/i);
  if (greenhouse) return decodeURIComponent(greenhouse[1]);
  const lever = url.match(/jobs\.lever\.co\/([^/]+)/i);
  if (lever) return decodeURIComponent(lever[1]);
  const match = titleFallback.match(/(?:at|@)\s+(.+?)(?:\s*[-|]|$)/i);
  return match?.[1]?.trim() ?? '';
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

  let payload: SaveJobPayload;
  try {
    payload = (await req.json()) as SaveJobPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers });
  }

  const url = (payload.url ?? '').trim();
  const jdText = (payload.jd_text ?? '').trim().slice(0, 50_000);
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: 'url must be http(s)' }, { status: 400, headers });
  }
  if (jdText.length < 50) {
    return NextResponse.json({ ok: false, error: 'jd_text too short' }, { status: 400, headers });
  }
  const storedUrl = canonicalJobUrl(url) ?? url;
  const urlVariants = jobUrlVariants(url);

  const [resumeResult, existingResult] = await Promise.all([
    db.execute({
      sql: 'SELECT id FROM resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      args: [userId],
    }),
    db.execute({
      sql: `SELECT id FROM job_applications WHERE url IN (${sqlPlaceholders(urlVariants)}) AND user_id = ? LIMIT 1`,
      args: [...urlVariants, userId],
    }),
  ]);

  const resumeId = resumeResult.rows[0]?.id ? String(resumeResult.rows[0].id) : null;
  if (!resumeId) {
    return NextResponse.json(
      { ok: false, error: 'Create a resume first', redirect_url: '/dashboard' },
      { status: 400, headers }
    );
  }

  let jobId = existingResult.rows[0]?.id ? String(existingResult.rows[0].id) : '';
  const existing = Boolean(jobId);
  if (!jobId) {
    const title = (payload.title ?? '').trim();
    const company =
      (payload.company ?? '').trim() || extractCompanyFromUrl(url, title) || 'Unknown';
    const role =
      title ||
      jdText
        .split('\n')
        .find((line) => line.trim().length > 0)
        ?.trim()
        .slice(0, 120) ||
      'Untitled role';
    jobId = uuid();
    await db.execute({
      sql: `INSERT INTO job_applications (id, resume_id, url, company, role, jd_raw, jd_text, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [jobId, resumeId, storedUrl, company, role, jdText, jdText, userId],
    });
  }

  const shouldQueue = payload.queue !== false;
  let queueId: string | null = null;
  if (shouldQueue) {
    const entry = await queueApplyAgentApplicationForUser(userId, jobId);
    queueId = entry.id;
  }

  return NextResponse.json(
    {
      ok: true,
      job_id: jobId,
      queue_id: queueId,
      existing,
      redirect_url: shouldQueue ? '/dashboard' : `/tailor/${jobId}`,
    },
    { status: existing ? 200 : 201, headers }
  );
}
