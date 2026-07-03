import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/internal/email/recruiter-reply', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  mockExecute.mockReset();
  vi.resetModules();
});

describe('POST /api/internal/email/recruiter-reply', () => {
  it('stores thread metadata and a suggested reply draft', async () => {
    const { buildReplyRoutingAddress } = await import('@/lib/recruiter-reply-routing');
    const to = buildReplyRoutingAddress('user-1');
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            resume_id: 'resume-1',
            url: 'https://jobs.acme.test/1',
            company: 'Acme',
            role: 'Frontend Engineer',
            jd_raw: '',
            jd_text: '',
            status: 'applied',
            interview_date: null,
            follow_up_at: null,
            salary_min: null,
            salary_max: null,
            salary_currency: null,
            offer_amount: null,
            notes: null,
            rejection_reason: null,
            created_at: 1,
            updated_at: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/internal/email/recruiter-reply/route');
    const res = await POST(
      makeReq({
        from: 'recruiter@acme.test',
        to,
        subject: 'Frontend Engineer interview',
        text: 'Can you schedule an interview?',
        message_id: 'msg-2',
        in_reply_to: 'msg-1',
      })
    );

    expect(res.status).toBe(200);
    const insertCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO recruiter_reply_events')
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall?.[0].args[10]).toBe('msg-1');
    expect(insertCall?.[0].args[11]).toBe('reply:msg-1');
    expect(insertCall?.[0].args[12]).toBe('Re: Frontend Engineer interview');
    expect(insertCall?.[0].args[13]).toContain('Frontend Engineer');
  });
});
