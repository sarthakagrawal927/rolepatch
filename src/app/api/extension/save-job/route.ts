import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';

import { queueApplyAgentApplicationForUser } from '@/lib/apply-agent-api';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { extensionCorsHeaders } from '@/lib/extension-cors';
import { parseExtensionJobInput } from '@/lib/extension-route-input';
import { canonicalJobUrl, jobUrlVariants, sqlPlaceholders } from '@/lib/job-url';

function extractCompanyFromUrl(url: string, titleFallback: string): string {
  const greenhouse = url.match(/boards\.greenhouse\.io\/([^/]+)/i);
  if (greenhouse) return decodeURIComponent(greenhouse[1]);
  const lever = url.match(/jobs\.lever\.co\/([^/]+)/i);
  if (lever) return decodeURIComponent(lever[1]);
  const match = titleFallback.match(/(?:at|@)\s+(.+?)(?:\s*[-|]|$)/i);
  return match?.[1]?.trim() ?? '';
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

  const parsed = parseExtensionJobInput(payload);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers });
  }

  const { url, jdText } = parsed.input;
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
    const title = parsed.input.title;
    const company = parsed.input.company || extractCompanyFromUrl(url, title) || 'Unknown';
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

  const shouldQueue = parsed.input.queue !== false;
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
