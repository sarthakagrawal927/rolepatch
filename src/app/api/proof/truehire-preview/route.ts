import { NextResponse } from 'next/server';

import {
  TRUEHIRE_PUBLIC_BASE_URL,
  mapTrueHirePublicExportToProof,
  normalizeTrueHireHandle,
  trueHireDataUrl,
} from '@/lib/truehire-proof';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const handle = normalizeTrueHireHandle(url.searchParams.get('handle') ?? '');
  if (!handle) {
    return NextResponse.json(
      { ok: false, error: 'Enter a TrueHire handle or profile URL.' },
      { status: 400 }
    );
  }

  const baseUrl = process.env.TRUEHIRE_PUBLIC_BASE_URL ?? TRUEHIRE_PUBLIC_BASE_URL;
  const sourceUrl = trueHireDataUrl(handle, baseUrl);
  const response = await fetch(sourceUrl, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return NextResponse.json({ ok: false, error: 'TrueHire profile not found.' }, { status: 404 });
  }
  if (!response.ok) {
    return NextResponse.json(
      { ok: false, error: 'TrueHire preview is unavailable right now.' },
      { status: 502 }
    );
  }

  const payload = await response.json();
  const preview = mapTrueHirePublicExportToProof(payload, baseUrl);
  return NextResponse.json({
    ok: true,
    source_url: sourceUrl,
    ...preview,
  });
}
