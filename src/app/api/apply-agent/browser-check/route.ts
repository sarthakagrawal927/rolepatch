import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  runReviewedApplyBrowserCheckBatchForUser,
  runReviewedApplyBrowserCheckForUser,
} from '@/lib/apply-agent-browser-run';
import { parseApplyAgentBrowserRunInput } from '@/lib/apply-agent-route-input';
import { getCurrentUserId } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(new Headers(req.headers));
  if (!userId) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseApplyAgentBrowserRunInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const { queueId, queueIds, limit } = parsed.input;

  try {
    if (!queueId) {
      const batch = await runReviewedApplyBrowserCheckBatchForUser(userId, {
        queueIds,
        limit,
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
