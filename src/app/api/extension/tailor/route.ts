import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';

// CORS for the Chrome extension. The extension origin is
// chrome-extension://<id>/ — we can't know the ID ahead of time, and Chrome
// sends Origin for fetch() from service workers, so reflect the Origin when
// it matches the chrome-extension: scheme. Fall back to * for preflight
// probes that don't send an Origin header.
function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = origin.startsWith('chrome-extension://') ? origin : '*';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-rolepatch-session',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

interface ExtensionPayload {
  url?: string;
  title?: string;
  company?: string;
  description?: string;
  source?: string;
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: 'Not authenticated' },
      { status: 401, headers },
    );
  }

  let payload: ExtensionPayload;
  try {
    payload = (await req.json()) as ExtensionPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON' },
      { status: 400, headers },
    );
  }

  if (!payload.url || !payload.description || payload.description.length < 50) {
    return NextResponse.json(
      { ok: false, error: 'Missing url or description' },
      { status: 400, headers },
    );
  }

  // TODO: persist job + description into `job_applications` and redirect to
  // the tailor page for that job. For now, hand the extension a URL that
  // drops the user on the dashboard's "new job" flow with the URL pre-filled.
  const redirect = new URL('/dashboard', req.nextUrl.origin);
  redirect.searchParams.set('jobUrl', payload.url);

  return NextResponse.json(
    { ok: true, url: redirect.toString() },
    { status: 200, headers },
  );
}
