import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import {
  buildWeeklyDigests,
  DIGEST_WINDOW_SECONDS,
  type DigestAlertRow,
  type DigestUser,
} from '@/lib/weekly-digest';

// Weekly saved-search email digest. Invoked ONLY by the Worker `scheduled`
// handler in worker.mjs (cron in wrangler.toml) — worker.mjs returns 404 for
// any external request under /api/internal/ before OpenNext sees the path.

const DASHBOARD_URL = 'https://rolepatch.com/dashboard';

export async function POST() {
  // Fail closed: without the email secret, log and skip cleanly.
  if (!isEmailConfigured()) {
    console.log('[weekly-digest] RESEND_API_KEY not set — skipping digest run');
    return NextResponse.json({ skipped: true, reason: 'email-not-configured' });
  }

  const since = Math.floor(Date.now() / 1000) - DIGEST_WINDOW_SECONDS;

  const users = await db.execute({
    sql: `SELECT u.id, u.email, u.name FROM users u
          WHERE u.email_digest_opt_out = 0 AND u.email != ''
            AND EXISTS (
              SELECT 1 FROM job_discovery_alerts a
              WHERE a.user_id = u.id AND a.alert_type = 'new_match' AND a.created_at > ?
            )`,
    args: [since],
  });
  const alerts = await db.execute({
    sql: `SELECT user_id, title, detail, created_at FROM job_discovery_alerts
          WHERE alert_type = 'new_match' AND created_at > ?
          ORDER BY created_at DESC`,
    args: [since],
  });

  const digests = buildWeeklyDigests(
    users.rows as unknown as DigestUser[],
    alerts.rows as unknown as DigestAlertRow[],
    DASHBOARD_URL
  );

  let sent = 0;
  let failed = 0;
  for (const digest of digests) {
    const result = await sendEmail(digest);
    if (result.sent) {
      sent++;
    } else {
      failed++;
      console.error(`[weekly-digest] send failed for user ${digest.userId}: ${result.error}`);
    }
  }

  console.log(`[weekly-digest] candidates=${digests.length} sent=${sent} failed=${failed}`);
  return NextResponse.json({ candidates: digests.length, sent, failed });
}
