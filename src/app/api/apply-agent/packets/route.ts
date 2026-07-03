import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { listApplyAgentPacketsForUser } from '@/lib/apply-agent-api';
import { getCurrentUserId } from '@/lib/auth-utils';

function jobIdsFromUrl(req: NextRequest): string[] | undefined {
  const params = req.nextUrl?.searchParams ?? new URL(req.url).searchParams;
  const repeated = params
    .getAll('job_id')
    .map((id) => id.trim())
    .filter(Boolean);
  const commaSeparated = (params.get('job_ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const ids = [...repeated, ...commaSeparated];
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId(new Headers(req.headers));
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const packets = await listApplyAgentPacketsForUser(userId, jobIdsFromUrl(req));
  return NextResponse.json({ ok: true, packets });
}
