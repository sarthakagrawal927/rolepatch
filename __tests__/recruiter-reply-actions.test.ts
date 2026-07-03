import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

const mockSendEmail = vi.fn();
vi.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  mockSendEmail.mockReset();
  mockRevalidatePath.mockReset();
  vi.resetModules();
});

describe('sendRecruiterReply', () => {
  it('sends the draft to the recruiter and stores sent metadata', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'event-1',
            from_email: 'recruiter@acme.test',
            to_email: 'reply+user-1@rolepatch.com',
            subject: 'Interview',
            suggested_reply_subject: 'Re: Interview',
            suggested_reply_body: 'Thanks',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    mockSendEmail.mockResolvedValue({ sent: true });

    const { sendRecruiterReply } = await import('@/lib/actions/recruiter-reply-actions');
    const result = await sendRecruiterReply('event-1', ' Re: Interview ', 'Thanks\nSarthak');

    expect(result.ok).toBe(true);
    expect(result.sent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: 'recruiter@acme.test',
      subject: 'Re: Interview',
      text: 'Thanks\nSarthak',
      html: '<p>Thanks<br />Sarthak</p>',
      replyTo: 'reply+user-1@rolepatch.com',
    });

    const updateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('reply_sent_at')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[0].args[1]).toBe('Re: Interview');
    expect(updateCall?.[0].args[2]).toBe('Thanks\nSarthak');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('fails closed and stores a send error when email is not configured', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'event-1',
            from_email: 'recruiter@acme.test',
            to_email: 'reply+user-1@rolepatch.com',
            subject: 'Interview',
            suggested_reply_subject: 'Re: Interview',
            suggested_reply_body: 'Thanks',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    mockSendEmail.mockResolvedValue({ sent: false, skipped: true });

    const { sendRecruiterReply } = await import('@/lib/actions/recruiter-reply-actions');
    const result = await sendRecruiterReply('event-1', 'Re: Interview', 'Thanks');

    expect(result.ok).toBe(false);
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toContain('RESEND_API_KEY');

    const updateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('reply_send_error')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[0].args[0]).toContain('RESEND_API_KEY');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
  });
});
