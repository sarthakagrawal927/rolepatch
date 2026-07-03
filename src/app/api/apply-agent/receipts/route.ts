import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  listApplyAgentReceiptsForUser,
  recordApplyAgentManualReceiptForUser,
} from '@/lib/apply-agent-api';
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

  let body: { queue_id?: string; confirmation_text?: string; confirmation_url?: string };
  try {
    body = (await req.json()) as {
      queue_id?: string;
      confirmation_text?: string;
      confirmation_url?: string;
    };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const queueId = body.queue_id?.trim();
  if (!queueId)
    return NextResponse.json({ ok: false, error: 'queue_id is required' }, { status: 400 });

  try {
    const receipt = await recordApplyAgentManualReceiptForUser(userId, {
      queueId,
      confirmationText: body.confirmation_text,
      confirmationUrl: body.confirmation_url,
    });
    return NextResponse.json({ ok: true, receipt }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Receipt failed' },
      { status: 400 }
    );
  }
}
