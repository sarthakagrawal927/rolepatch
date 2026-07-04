import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  listApplyAgentReceiptsForUser,
  recordApplyAgentManualReceiptForUser,
} from '@/lib/apply-agent-api';
import { parseApplyAgentManualReceiptInput } from '@/lib/apply-agent-route-input';
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
  const receipts = await listApplyAgentReceiptsForUser(userId, jobIdsFromUrl(req));
  return NextResponse.json({ ok: true, receipts });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(new Headers(req.headers));
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseApplyAgentManualReceiptInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  try {
    const receipt = await recordApplyAgentManualReceiptForUser(userId, {
      queueId: parsed.input.queueId,
      confirmationText: parsed.input.confirmationText,
      confirmationUrl: parsed.input.confirmationUrl,
    });
    return NextResponse.json({ ok: true, receipt }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Receipt failed' },
      { status: 400 }
    );
  }
}
