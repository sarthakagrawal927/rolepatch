import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SaveJobRoute from '@/app/api/extension/save-job/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/extension/save-job', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<(typeof SaveJobRoute)['POST']>[0];
}

const longJd = 'Senior engineer role building reliable Cloudflare applications. '.repeat(8);

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  vi.resetModules();
});

describe('POST /api/extension/save-job', () => {
  it('rejects signed-out saves', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/extension/save-job/route');

    const res = await POST(makeReq({ url: 'https://example.com/jobs/1', jd_text: longJd }));

    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('creates and queues a scraped job from the extension', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-created',
            resume_id: 'resume-1',
            url: 'https://boards.greenhouse.io/acme/jobs/123',
            status: 'draft',
            tailored_count: 0,
            cover_letter_count: 0,
            receipt_count: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'queue-1',
            job_id: 'job-created',
            status: 'queued',
            readiness_json:
              '{"status":"needs_tailoring","summary":"Tailor the resume before this application can be reviewed.","missing":["tailored resume"],"checks":{"resume":true,"tailored_resume":false,"cover_letter":false,"profile_answers":false,"receipt":false}}',
            created_at: 1,
            updated_at: 2,
          },
        ],
      });

    const { POST } = await import('@/app/api/extension/save-job/route');
    const res = await POST(
      makeReq({
        url: 'https://boards.greenhouse.io/acme/jobs/123',
        title: 'Senior Platform Engineer',
        company: 'Acme',
        jd_text: longJd,
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.job_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.queue_id).toBe('queue-1');
    expect(json.redirect_url).toBe('/dashboard');
  });

  it('reuses an existing tracked job and refreshes its queue entry', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'resume-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'job-existing' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-existing',
            resume_id: 'resume-1',
            url: 'https://jobs.lever.co/acme/1',
            status: 'tailored',
            tailored_count: 1,
            cover_letter_count: 1,
            receipt_count: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'queue-existing',
            job_id: 'job-existing',
            status: 'queued',
            readiness_json:
              '{"status":"ready_for_review","summary":"Ready","missing":[],"checks":{"resume":true,"tailored_resume":true,"cover_letter":true,"profile_answers":true,"receipt":false}}',
            created_at: 1,
            updated_at: 2,
          },
        ],
      });

    const { POST } = await import('@/app/api/extension/save-job/route');
    const res = await POST(
      makeReq({
        url: 'https://jobs.lever.co/acme/1',
        title: 'Senior Platform Engineer',
        jd_text: longJd,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.existing).toBe(true);
    expect(json.job_id).toBe('job-existing');
    expect(json.queue_id).toBe('queue-existing');
  });
});
