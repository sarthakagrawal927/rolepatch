import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  runGuardedApplyBrowserSubmitBatchForUser,
  runGuardedApplyBrowserSubmitForUser,
} from '@/lib/apply-agent-browser-run';
import { parseApplyAgentBrowserRunInput } from '@/lib/apply-agent-route-input';
import { getCurrentUserId } from '@/lib/auth-utils';

const GUARDED_SUBMIT_GUARDRAILS = {
  mode: 'guarded_submit',
  unattended: false,
  requires_ready_queue: true,
  refuses_captcha: true,
  refuses_file_uploads: true,
  refuses_missing_required_fields: true,
  requires_confirmation_detection: true,
  enforces_daily_submit_cap: true,
  enforces_queue_safety: true,
} as const;

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
      const batch = await runGuardedApplyBrowserSubmitBatchForUser(userId, {
        queueIds,
        limit,
      });
      return NextResponse.json({ ok: true, batch, guardrails: GUARDED_SUBMIT_GUARDRAILS });
    }
    const result = await runGuardedApplyBrowserSubmitForUser(userId, queueId);
    return NextResponse.json({ ok: true, result, guardrails: GUARDED_SUBMIT_GUARDRAILS });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Guarded submit failed' },
      { status: 400 }
    );
  }
}
