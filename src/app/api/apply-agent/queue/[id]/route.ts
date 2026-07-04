import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  retryApplyAgentQueueEntryForUser,
  updateApplyAgentQueueStatusForUser,
} from '@/lib/apply-agent-api';
import {
  parseApplyAgentQueueRetryInput,
  parseApplyAgentQueueStatusInput,
} from '@/lib/apply-agent-route-input';
import { getCurrentUserId } from '@/lib/auth-utils';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId(new Headers(req.headers));
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: 'queue id is required' }, { status: 400 });
  const parsed = parseApplyAgentQueueStatusInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  try {
    const entry = await updateApplyAgentQueueStatusForUser(userId, id, parsed.input.status);
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id) return NextResponse.json({ ok: false, error: 'queue id is required' }, { status: 400 });
  const parsed = parseApplyAgentQueueRetryInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

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
