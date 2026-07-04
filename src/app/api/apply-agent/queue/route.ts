import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  bulkUpdateApplyAgentQueueStatusForUser,
  listApplyAgentQueueForUser,
  queueApplyAgentApplicationForUser,
} from '@/lib/apply-agent-api';
import {
  parseApplyAgentQueueBulkStatusInput,
  parseApplyAgentQueueCreateInput,
} from '@/lib/apply-agent-route-input';
import { getCurrentUserId } from '@/lib/auth-utils';

async function requireUser(req: NextRequest): Promise<string | null> {
  return getCurrentUserId(new Headers(req.headers));
}

export async function GET(req: NextRequest) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  const queue = await listApplyAgentQueueForUser(userId);
  return NextResponse.json({ ok: true, queue });
}

export async function POST(req: NextRequest) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseApplyAgentQueueCreateInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  try {
    const entry = await queueApplyAgentApplicationForUser(userId, parsed.input.jobId);
    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Queue failed' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUser(req);
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseApplyAgentQueueBulkStatusInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  try {
    const entries = await bulkUpdateApplyAgentQueueStatusForUser(
      userId,
      parsed.input.queueIds,
      parsed.input.status
    );
    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Bulk update failed' },
      { status: 400 }
    );
  }
}
