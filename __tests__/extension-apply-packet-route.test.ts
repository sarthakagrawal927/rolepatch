import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ApplyPacketRoute from '@/app/api/extension/apply-packet/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/extension/apply-packet', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<(typeof ApplyPacketRoute)['POST']>[0];
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  vi.resetModules();
});

describe('POST /api/extension/apply-packet', () => {
  it('rejects signed-out requests', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/extension/apply-packet/route');
    const res = await POST(makeReq({ url: 'https://boards.greenhouse.io/acme/jobs/1' }));
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns 404 when the current ATS URL is not tracked', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const { POST } = await import('@/app/api/extension/apply-packet/route');
    const res = await POST(makeReq({ url: 'https://jobs.lever.co/acme/abc' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.redirect_url).toBe('/dashboard');
  });

  it('returns the latest prepared packet for a tracked job URL', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            url: 'https://boards.greenhouse.io/acme/jobs/1',
            company: 'Acme',
            role: 'Frontend Engineer',
            resume_id: 'resume-1',
            resume_name: 'Base resume',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'tailored-1', source: 'Tailored resume body' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cover-1', content: 'Cover letter body' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'answer-1',
            category: 'work_authorization',
            label: 'Authorized to work in the US?',
            answer: 'Yes',
            sensitive: 1,
            created_at: 1,
            updated_at: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'receipt-1',
            job_id: 'job-1',
            queue_id: 'queue-1',
            provider: 'greenhouse',
            status: 'submitted',
            fields_json: '[{"label":"Submission mode","value":"Manual","source":"user"}]',
            resume_id: 'resume-1',
            cover_letter_id: 'cover-1',
            confirmation_text: 'Submitted',
            confirmation_url: null,
            failure_reason: null,
            created_at: 3,
          },
        ],
      });

    const { POST } = await import('@/app/api/extension/apply-packet/route');
    const res = await POST(makeReq({ url: 'https://boards.greenhouse.io/acme/jobs/1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.packet.ats_provider).toBe('greenhouse');
    expect(json.packet.profile_answers).toHaveLength(1);
    expect(json.packet.receipt.fields).toHaveLength(1);
    expect(json.packet.cover_letter_text).toContain('Cover letter');
  });

  it('matches tracked jobs when the current tab URL has query params or a hash', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            url: 'https://jobs.lever.co/acme/abc',
            company: 'Acme',
            role: 'Backend Engineer',
            resume_id: 'resume-1',
            resume_name: 'Base resume',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/extension/apply-packet/route');
    const res = await POST(
      makeReq({ url: 'https://jobs.lever.co/acme/abc?utm_source=linkedin#apply' })
    );

    expect(res.status).toBe(200);
    expect(mockExecute.mock.calls[0][0].args).toEqual([
      'https://jobs.lever.co/acme/abc?utm_source=linkedin#apply',
      'https://jobs.lever.co/acme/abc',
      'user-1',
    ]);
  });
});
