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

export interface DigestQueueRow {
  user_id: string;
  status: string;
  updated_at: number;
}

export interface DigestReceiptRow {
  user_id: string;
  status: string;
  provider: string;
  created_at: number;
}

export interface DigestEmail {
  userId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface ApplyActivitySummary {
  total: number;
  queued: number;
  ready: number;
  needsUser: number;
  submitted: number;
  filled: number;
  failed: number;
  providers: string[];
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function summarizeApplyActivity(
  queueRows: Array<Pick<DigestQueueRow, 'status'>>,
  receiptRows: Array<Pick<DigestReceiptRow, 'status' | 'provider'>>
): ApplyActivitySummary {
  const providers = new Set<string>();
  for (const receipt of receiptRows) {
    const provider = receipt.provider.trim();
    if (provider) providers.add(provider);
  }

  return {
    total: queueRows.length + receiptRows.length,
    queued: queueRows.filter((row) => row.status === 'queued').length,
    ready: queueRows.filter((row) => row.status === 'ready_to_submit').length,
    needsUser: queueRows.filter((row) => row.status === 'needs_user' || row.status === 'failed')
      .length,
    submitted: receiptRows.filter((row) => row.status === 'submitted').length,
    filled: receiptRows.filter((row) => row.status === 'filled').length,
    failed: receiptRows.filter((row) => row.status === 'failed').length,
    providers: Array.from(providers).slice(0, 4),
  };
}

function applyActivityLines(summary: ApplyActivitySummary): string[] {
  return [
    summary.queued > 0 ? `${summary.queued} queued for review` : '',
    summary.ready > 0 ? `${summary.ready} ready for guarded submit` : '',
    summary.needsUser > 0 ? `${summary.needsUser} need your attention` : '',
    summary.filled > 0 ? `${summary.filled} fill receipts recorded` : '',
    summary.submitted > 0 ? `${summary.submitted} submitted receipts captured` : '',
    summary.failed > 0 ? `${summary.failed} blocked attempts need retry` : '',
    summary.providers.length > 0 ? `Recent ATS: ${summary.providers.join(', ')}` : '',
  ].filter(Boolean);
}

/** Build one user's digest email; returns null when there is nothing to send. */
export function buildWeeklyDigest(
  user: DigestUser,
  alerts: Array<Pick<DigestAlertRow, 'title' | 'detail'>>,
  dashboardUrl: string,
  queueRows: Array<Pick<DigestQueueRow, 'status'>> = [],
  receiptRows: Array<Pick<DigestReceiptRow, 'status' | 'provider'>> = []
): DigestEmail | null {
  const activity = summarizeApplyActivity(queueRows, receiptRows);
  if (!user.email.trim() || (alerts.length === 0 && activity.total === 0)) return null;

  const count = alerts.length;
  const subject =
    activity.total > 0
      ? count > 0
        ? `${count} new ${count === 1 ? 'match' : 'matches'} + ${activity.total} apply updates this week — RolePatch`
        : `${activity.total} apply ${activity.total === 1 ? 'update' : 'updates'} this week — RolePatch`
      : count === 1
        ? '1 new job match this week — RolePatch'
        : `${count} new job matches this week — RolePatch`;

  const shown = alerts.slice(0, DIGEST_MAX_ITEMS);
  const overflow = count - shown.length;
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';
  const activityLines = applyActivityLines(activity);

  const itemsHtml = shown
    .map(
      (alert) =>
        `<li style="margin:0 0 8px;"><strong>${escapeHtml(alert.title)}</strong><br/>` +
        `<span style="color:#6b7280;">${escapeHtml(alert.detail)}</span></li>`
    )
    .join('\n');
  const activityHtml = activityLines
    .map((line) => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
    .join('\n');

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827;">
  <p style="font-size:14px;">Hi ${escapeHtml(firstName)},</p>
${
  count > 0
    ? `  <p style="font-size:14px;">Your saved job searches on RolePatch turned up
    <strong>${count} new ${count === 1 ? 'match' : 'matches'}</strong> this week:</p>
  <ul style="font-size:14px;padding-left:20px;">
${itemsHtml}
  </ul>
${overflow > 0 ? `  <p style="font-size:13px;color:#6b7280;">…and ${overflow} more in your dashboard.</p>\n` : ''}`
    : ''
}${
  activityLines.length > 0
    ? `  <p style="font-size:14px;margin-top:18px;"><strong>Apply-agent recap</strong></p>
  <ul style="font-size:14px;padding-left:20px;">
${activityHtml}
  </ul>
`
    : ''
}  <p style="margin:24px 0;">
    <a href="${dashboardUrl}" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">View &amp; apply in your dashboard</a>
  </p>
  <p style="font-size:12px;color:#9ca3af;">You're getting this because you saved job-search alerts or used the apply-agent queue on RolePatch.
    To stop weekly emails, untick "Email me a weekly digest" in the
    <a href="${dashboardUrl}" style="color:#6b7280;">saved-searches panel</a>.</p>
</div>`;

  const textItems = shown.map((alert) => `- ${alert.title} (${alert.detail})`).join('\n');
  const activityText =
    activityLines.length > 0
      ? `\nApply-agent recap:\n${activityLines.map((line) => `- ${line}`).join('\n')}\n`
      : '';
  const text = `Hi ${firstName},

${
  count > 0
    ? `Your saved job searches on RolePatch turned up ${count} new ${count === 1 ? 'match' : 'matches'} this week:

${textItems}
${overflow > 0 ? `…and ${overflow} more in your dashboard.\n` : ''}
`
    : ''
}${activityText}
View & apply: ${dashboardUrl}

To stop weekly emails, untick "Email me a weekly digest" in the saved-searches panel on your dashboard.`;

  return { userId: user.id, to: user.email, subject, html, text };
}

/** Group alert rows per user and build one digest per user with fresh matches. */
export function buildWeeklyDigests(
  users: DigestUser[],
  alerts: DigestAlertRow[],
  dashboardUrl: string,
  queueRows: DigestQueueRow[] = [],
  receiptRows: DigestReceiptRow[] = []
): DigestEmail[] {
  const byUser = new Map<string, DigestAlertRow[]>();
  for (const alert of alerts) {
    const list = byUser.get(alert.user_id);
    if (list) list.push(alert);
    else byUser.set(alert.user_id, [alert]);
  }
  const queueByUser = new Map<string, DigestQueueRow[]>();
  for (const row of queueRows) {
    const list = queueByUser.get(row.user_id);
    if (list) list.push(row);
    else queueByUser.set(row.user_id, [row]);
  }
  const receiptsByUser = new Map<string, DigestReceiptRow[]>();
  for (const row of receiptRows) {
    const list = receiptsByUser.get(row.user_id);
    if (list) list.push(row);
    else receiptsByUser.set(row.user_id, [row]);
  }

  const digests: DigestEmail[] = [];
  for (const user of users) {
    const digest = buildWeeklyDigest(
      user,
      byUser.get(user.id) ?? [],
      dashboardUrl,
      queueByUser.get(user.id) ?? [],
      receiptsByUser.get(user.id) ?? []
    );
    if (digest) digests.push(digest);
  }
  return digests;
}
