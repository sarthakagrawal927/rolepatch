import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-utils';

// CORS: the extension origin is chrome-extension://<id>/ — unknown ahead of time.
// Reflect the Origin when it's a chrome-extension scheme.
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

// Per-user sliding-window rate limit.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, number[]>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const stamps = (rateLimitMap.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (stamps.length >= RATE_LIMIT_MAX) return false;
  stamps.push(now);
  rateLimitMap.set(key, stamps);
  return true;
}

interface ExtensionPayload {
  url?: string;
  title?: string;
  company?: string;
  jd_text?: string;
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

  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Not authenticated', redirect_url: '/api/auth/signin' },
      { status: 401, headers },
    );
  }

  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded — max 10 per minute.' },
      { status: 429, headers },
    );
  }

  let payload: ExtensionPayload;
  try {
    payload = (await req.json()) as ExtensionPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400, headers });
  }

  const url = (payload.url ?? '').trim();
  const jdText = (payload.jd_text ?? '').trim().slice(0, 50_000);
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: 'url must be http(s)' }, { status: 400, headers });
  }
  if (jdText.length < 100) {
    return NextResponse.json({ ok: false, error: 'jd_text too short' }, { status: 400, headers });
  }

  // Pick the user's most recent resume.
  const resumeRes = await db.execute({
    sql: 'SELECT id FROM resumes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
    args: [userId],
  });
  const resumeRow = resumeRes.rows[0];
  if (!resumeRow) {
    return NextResponse.json(
      { ok: false, error: 'Create a resume first', redirect_url: '/dashboard' },
      { status: 400, headers },
    );
  }
  const resumeId = String(resumeRow.id);

  // Idempotency: if this user already has a job_applications row for this URL,
  // return its ID instead of creating a duplicate.
  const existing = await db.execute({
    sql: 'SELECT id FROM job_applications WHERE url = ? AND user_id = ? LIMIT 1',
    args: [url, userId],
  });
  if (existing.rows[0]) {
    const jobId = String(existing.rows[0].id);
    return NextResponse.json(
      { ok: true, job_id: jobId, redirect_url: `/tailor/${jobId}` },
      { status: 200, headers },
    );
  }

  const title = (payload.title ?? '').trim();
  const company =
    (payload.company ?? '').trim() || extractCompanyFromUrl(url, title) || 'Unknown';
  const role = title || jdText.split('\n').find((l) => l.trim().length > 0)?.trim().slice(0, 120) || 'Untitled role';

  const jobId = uuid();
  await db.execute({
    sql: `INSERT INTO job_applications (id, resume_id, url, company, role, jd_raw, jd_text, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [jobId, resumeId, url, company, role, jdText, jdText, userId],
  });

  return NextResponse.json(
    { ok: true, job_id: jobId, redirect_url: `/tailor/${jobId}` },
    { status: 200, headers },
  );
}
