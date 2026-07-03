// Minimal Resend email adapter (plain fetch — no SDK, keeps the Worker bundle
// lean, same pattern as the Turso HTTP client in db.ts).
//
// Fail-closed: if the RESEND_API_KEY secret is unset, sends are logged and
// skipped without throwing, so cron runs stay green in un-provisioned
// environments. Set the secret with: wrangler secret put RESEND_API_KEY

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

const DEFAULT_FROM = 'RolePatch <alerts@rolepatch.com>';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log('[email] RESEND_API_KEY not set — skipping send');
    return { sent: false, skipped: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { sent: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { sent: true };
}
