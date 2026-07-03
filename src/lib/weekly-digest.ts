// Weekly job-alert email digest assembly. Pure functions with no I/O so the
// cron route stays a thin shell and this logic is unit-testable
// (__tests__/weekly-digest.test.ts).

export const DIGEST_MAX_ITEMS = 10;
export const DIGEST_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export interface DigestUser {
  id: string;
  email: string;
  name: string;
}

export interface DigestAlertRow {
  user_id: string;
  title: string;
  detail: string;
  created_at: number;
}

export interface DigestEmail {
  userId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Build one user's digest email; returns null when there is nothing to send. */
export function buildWeeklyDigest(
  user: DigestUser,
  alerts: Array<Pick<DigestAlertRow, 'title' | 'detail'>>,
  dashboardUrl: string
): DigestEmail | null {
  if (!user.email.trim() || alerts.length === 0) return null;

  const count = alerts.length;
  const subject =
    count === 1
      ? '1 new job match this week — RolePatch'
      : `${count} new job matches this week — RolePatch`;

  const shown = alerts.slice(0, DIGEST_MAX_ITEMS);
  const overflow = count - shown.length;
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';

  const itemsHtml = shown
    .map(
      (alert) =>
        `<li style="margin:0 0 8px;"><strong>${escapeHtml(alert.title)}</strong><br/>` +
        `<span style="color:#6b7280;">${escapeHtml(alert.detail)}</span></li>`
    )
    .join('\n');

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
  <p style="font-size:14px;">Hi ${escapeHtml(firstName)},</p>
  <p style="font-size:14px;">Your saved job searches on RolePatch turned up
    <strong>${count} new ${count === 1 ? 'match' : 'matches'}</strong> this week:</p>
  <ul style="font-size:14px;padding-left:20px;">
${itemsHtml}
  </ul>
${overflow > 0 ? `  <p style="font-size:13px;color:#6b7280;">…and ${overflow} more in your dashboard.</p>\n` : ''}  <p style="margin:24px 0;">
    <a href="${dashboardUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View &amp; apply in your dashboard</a>
  </p>
  <p style="font-size:12px;color:#9ca3af;">You're getting this because you saved job-search alerts on RolePatch.
    To stop weekly emails, untick "Email me a weekly digest" in the
    <a href="${dashboardUrl}" style="color:#6b7280;">saved-searches panel</a>.</p>
</div>`;

  const textItems = shown.map((alert) => `- ${alert.title} (${alert.detail})`).join('\n');
  const text = `Hi ${firstName},

Your saved job searches on RolePatch turned up ${count} new ${count === 1 ? 'match' : 'matches'} this week:

${textItems}
${overflow > 0 ? `…and ${overflow} more in your dashboard.\n` : ''}
View & apply: ${dashboardUrl}

To stop weekly emails, untick "Email me a weekly digest" in the saved-searches panel on your dashboard.`;

  return { userId: user.id, to: user.email, subject, html, text };
}

/** Group alert rows per user and build one digest per user with fresh matches. */
export function buildWeeklyDigests(
  users: DigestUser[],
  alerts: DigestAlertRow[],
  dashboardUrl: string
): DigestEmail[] {
  const byUser = new Map<string, DigestAlertRow[]>();
  for (const alert of alerts) {
    const list = byUser.get(alert.user_id);
    if (list) list.push(alert);
    else byUser.set(alert.user_id, [alert]);
  }

  const digests: DigestEmail[] = [];
  for (const user of users) {
    const digest = buildWeeklyDigest(user, byUser.get(user.id) ?? [], dashboardUrl);
    if (digest) digests.push(digest);
  }
  return digests;
}
