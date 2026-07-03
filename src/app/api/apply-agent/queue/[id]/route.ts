import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  retryApplyAgentQueueEntryForUser,
  updateApplyAgentQueueStatusForUser,
} from '@/lib/apply-agent-api';
import { getCurrentUserId } from '@/lib/auth-utils';
import type { ApplicationQueueStatus } from '@/lib/types';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId(new Headers(req.headers));
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: { status?: ApplicationQueueStatus };
  try {
    body = (await req.json()) as { status?: ApplicationQueueStatus };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: 'queue id is required' }, { status: 400 });
  if (!body.status)
    return NextResponse.json({ ok: false, error: 'status is required' }, { status: 400 });

  try {
    const entry = await updateApplyAgentQueueStatusForUser(userId, id, body.status);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Update failed' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId(new Headers(req.headers));
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: 'queue id is required' }, { status: 400 });
  if (body.action !== 'retry') {
    return NextResponse.json({ ok: false, error: 'action must be retry' }, { status: 400 });
  }

  try {
    const entry = await retryApplyAgentQueueEntryForUser(userId, id);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Retry failed' },
      { status: 400 }
    );
  }
}
