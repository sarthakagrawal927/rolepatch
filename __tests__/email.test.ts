import { afterEach, describe, expect, it, vi } from 'vitest';

import { isEmailConfigured, sendEmail } from '@/lib/email';

const email = {
  to: 'sam@example.com',
  subject: 'Test',
  html: '<p>Hi</p>',
  text: 'Hi',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('email adapter (Resend)', () => {
  it('fails closed when RESEND_API_KEY is unset — skips without calling fetch', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(isEmailConfigured()).toBe(false);
    const result = await sendEmail(email);
    expect(result).toEqual({ sent: false, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to Resend with bearer auth when configured', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'RolePatch <alerts@rolepatch.com>');
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    expect(isEmailConfigured()).toBe(true);
    const result = await sendEmail(email);
    expect(result.sent).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.from).toBe('RolePatch <alerts@rolepatch.com>');
    expect(body.to).toEqual(['sam@example.com']);
    expect(body.subject).toBe('Test');
  });

  it('passes reply_to when a Reply-To address is provided', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await sendEmail({ ...email, replyTo: 'reply+user@rolepatch.com' });
    expect(result.sent).toBe(true);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.reply_to).toBe('reply+user@rolepatch.com');
  });

  it('surfaces Resend API errors without throwing', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('{"message":"invalid from"}', { status: 422 }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await sendEmail(email);
    expect(result.sent).toBe(false);
    expect(result.error).toContain('Resend 422');
  });
});
