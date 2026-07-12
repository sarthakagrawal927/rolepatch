import { NextResponse } from 'next/server';

import {
  TRUEHIRE_PUBLIC_BASE_URL,
  mapTrueHireRoleFitExport,
  normalizeTrueHireHandle,
  trueHireRoleFitUrl,
} from '@/lib/truehire-proof';

export const dynamic = 'force-dynamic';

const MIN_JD_LENGTH = 40;
const MAX_JD_LENGTH = 12_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const handle = normalizeTrueHireHandle(url.searchParams.get('handle') ?? '');
  if (!handle) {
    return NextResponse.json(
      { ok: false, error: 'Enter a TrueHire handle or profile URL.' },
      { status: 400 }
    );
  }

  const jd = (url.searchParams.get('jd') ?? '').trim();
  if (jd.length < MIN_JD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: 'Paste at least 40 characters of job description.' },
      { status: 400 }
    );
  }
  if (jd.length > MAX_JD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: 'Job description is too long for the TrueHire role-fit preview.' },
      { status: 400 }
    );
  }

  const baseUrl = process.env.TRUEHIRE_PUBLIC_BASE_URL ?? TRUEHIRE_PUBLIC_BASE_URL;
  const sourceUrl = trueHireRoleFitUrl(handle, jd, baseUrl);
  const response = await fetch(sourceUrl, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return NextResponse.json(
      { ok: false, error: 'TrueHire profile or score not found.' },
      { status: 404 }
    );
  }
  if (response.status === 400) {
    return NextResponse.json(
      { ok: false, error: 'TrueHire role-fit preview needs a valid handle and job description.' },
      { status: 400 }
    );
  }
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: 'TrueHire role-fit preview is unavailable right now.' },
      { status: 502 }
    );
  }

  const payload = await response.json();
  return NextResponse.json({
    ok: true,
    source_url: sourceUrl,
    role_fit: mapTrueHireRoleFitExport(payload, baseUrl),
    boundary:
      'Role-fit preview is read-only. RolePatch does not import, attach, or share this report automatically.',
  });
}
