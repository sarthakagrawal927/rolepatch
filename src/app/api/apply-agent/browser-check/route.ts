import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  runReviewedApplyBrowserCheckBatchForUser,
  runReviewedApplyBrowserCheckForUser,
} from '@/lib/apply-agent-browser-run';
import { getCurrentUserId } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(new Headers(req.headers));
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: { queue_id?: string; queue_ids?: string[]; limit?: number };
  try {
    body = (await req.json()) as { queue_id?: string; queue_ids?: string[]; limit?: number };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const queueId = body.queue_id?.trim();
  const queueIds = Array.isArray(body.queue_ids)
    ? body.queue_ids.filter((id) => typeof id === 'string' && id.trim())
    : [];
  if (!queueId && queueIds.length === 0 && body.limit == null) {
    return NextResponse.json({ ok: false, error: 'queue_id is required' }, { status: 400 });
  }

  try {
    if (!queueId) {
      const batch = await runReviewedApplyBrowserCheckBatchForUser(userId, {
        queueIds,
        limit: body.limit,
      });
      return NextResponse.json({ ok: true, batch });
    }
    const result = await runReviewedApplyBrowserCheckForUser(userId, queueId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Browser check failed' },
      { status: 400 }
    );
  }
}
