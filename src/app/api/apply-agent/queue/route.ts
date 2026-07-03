import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  bulkUpdateApplyAgentQueueStatusForUser,
  listApplyAgentQueueForUser,
  queueApplyAgentApplicationForUser,
} from '@/lib/apply-agent-api';
import { getCurrentUserId } from '@/lib/auth-utils';
import type { ApplicationQueueStatus } from '@/lib/types';

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

  let body: { job_id?: string };
  try {
    body = (await req.json()) as { job_id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const jobId = body.job_id?.trim();
  if (!jobId) return NextResponse.json({ ok: false, error: 'job_id is required' }, { status: 400 });

  try {
    const entry = await queueApplyAgentApplicationForUser(userId, jobId);
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

  let body: { queue_ids?: string[]; status?: ApplicationQueueStatus };
  try {
    body = (await req.json()) as { queue_ids?: string[]; status?: ApplicationQueueStatus };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const queueIds = Array.isArray(body.queue_ids)
    ? body.queue_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  if (queueIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'queue_ids is required' }, { status: 400 });
  }
  if (!body.status) {
    return NextResponse.json({ ok: false, error: 'status is required' }, { status: 400 });
  }

  try {
    const entries = await bulkUpdateApplyAgentQueueStatusForUser(userId, queueIds, body.status);
    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Bulk update failed' },
      { status: 400 }
    );
  }
}
