import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as QueueRoute from '@/app/api/apply-agent/queue/route';
import type * as QueueIdRoute from '@/app/api/apply-agent/queue/[id]/route';
import type * as PacketsRoute from '@/app/api/apply-agent/packets/route';
import type * as ReceiptsRoute from '@/app/api/apply-agent/receipts/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

function makeReq(url: string, body?: unknown) {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  vi.resetModules();
});

describe('apply-agent API routes', () => {
  it('rejects unauthenticated queue reads', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { GET } = await import('@/app/api/apply-agent/queue/route');
    const res = await GET(
      makeReq('https://rolepatch.com/api/apply-agent/queue') as Parameters<typeof QueueRoute.GET>[0]
    );
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('lists queue entries for an authenticated user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute.mockResolvedValueOnce({
      rows: [
        {
          id: 'queue-1',
          job_id: 'job-1',
          status: 'queued',
          readiness_json:
            '{"status":"ready_for_review","summary":"Ready","missing":[],"checks":{"resume":true,"tailored_resume":true,"cover_letter":true,"profile_answers":true,"receipt":false}}',
          created_at: 1,
          updated_at: 2,
        },
      ],
    });

    const { GET } = await import('@/app/api/apply-agent/queue/route');
    const res = await GET(
      makeReq('https://rolepatch.com/api/apply-agent/queue') as Parameters<typeof QueueRoute.GET>[0]
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.queue[0].id).toBe('queue-1');
    expect(json.queue[0].readiness.status).toBe('ready_for_review');
  });

  it('queues a job through the API', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
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
            id: 'queue-1',
            job_id: 'job-1',
            status: 'queued',
            readiness_json:
              '{"status":"ready_for_review","summary":"Ready","missing":[],"checks":{"resume":true,"tailored_resume":true,"cover_letter":true,"profile_answers":true,"receipt":false}}',
            created_at: 1,
            updated_at: 2,
          },
        ],
      });

    const { POST } = await import('@/app/api/apply-agent/queue/route');
    const res = await POST(
      makeReq('https://rolepatch.com/api/apply-agent/queue', { job_id: 'job-1' }) as Parameters<
        typeof QueueRoute.POST
      >[0]
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.entry.job_id).toBe('job-1');
  });

  it('updates queue status through the API', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          id: 'queue-1',
          job_id: 'job-1',
          status: 'ready_to_submit',
          readiness_json: '{}',
          created_at: 1,
          updated_at: 2,
        },
      ],
    });

    const { PATCH } = await import('@/app/api/apply-agent/queue/[id]/route');
    const res = await PATCH(
      makeReq('https://rolepatch.com/api/apply-agent/queue/queue-1', {
        status: 'ready_to_submit',
      }) as Parameters<typeof QueueIdRoute.PATCH>[0],
      { params: Promise.resolve({ id: 'queue-1' }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).entry.status).toBe('ready_to_submit');
  });

  it('retries a failed queue entry through the API', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'queue-1',
            job_id: 'job-1',
            status: 'failed',
            readiness_json: '{}',
            created_at: 1,
            updated_at: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            resume_id: 'resume-1',
            url: 'https://jobs.lever.co/acme/1',
            status: 'tailored',
            tailored_count: 1,
            cover_letter_count: 1,
            receipt_count: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'queue-1',
            job_id: 'job-1',
            status: 'ready_to_submit',
            readiness_json:
              '{"status":"ready_for_review","summary":"Ready","missing":[],"checks":{"resume":true,"tailored_resume":true,"cover_letter":true,"profile_answers":true,"receipt":true}}',
            created_at: 1,
            updated_at: 3,
          },
        ],
      });

    const { POST } = await import('@/app/api/apply-agent/queue/[id]/route');
    const res = await POST(
      makeReq('https://rolepatch.com/api/apply-agent/queue/queue-1', {
        action: 'retry',
      }) as Parameters<typeof QueueIdRoute.POST>[0],
      { params: Promise.resolve({ id: 'queue-1' }) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entry.status).toBe('ready_to_submit');
  });

  it('bulk updates queue statuses through the API', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          id: 'queue-1',
          job_id: 'job-1',
          status: 'skipped',
          readiness_json: '{}',
          created_at: 1,
          updated_at: 2,
        },
        {
          id: 'queue-2',
          job_id: 'job-2',
          status: 'skipped',
          readiness_json: '{}',
          created_at: 1,
          updated_at: 2,
        },
      ],
    });

    const { PATCH } = await import('@/app/api/apply-agent/queue/route');
    const res = await PATCH(
      makeReq('https://rolepatch.com/api/apply-agent/queue', {
        queue_ids: ['queue-1', 'queue-2'],
        status: 'skipped',
      }) as Parameters<typeof QueueRoute.PATCH>[0]
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entries).toHaveLength(2);
    expect(json.entries[0].status).toBe('skipped');
  });

  it('lists packets with job filters', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            url: 'https://boards.greenhouse.io/acme/jobs/1',
            resume_id: 'r1',
            resume_name: 'Base',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'tailored-1', job_id: 'job-1', source: 'Tailored' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cover-1', job_id: 'job-1', content: 'Cover' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'answer-1',
            category: 'links',
            label: 'LinkedIn',
            answer: 'https://in',
            sensitive: 0,
            created_at: 1,
            updated_at: 1,
          },
        ],
      });

    const { GET } = await import('@/app/api/apply-agent/packets/route');
    const res = await GET(
      new Request('https://rolepatch.com/api/apply-agent/packets?job_id=job-1') as Parameters<
        typeof PacketsRoute.GET
      >[0]
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.packets[0].ats_provider).toBe('greenhouse');
    expect(json.packets[0].profile_answers).toHaveLength(1);
  });

  it('records a manual receipt through the API', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'queue-1',
            job_id: 'job-1',
            readiness_json: '{}',
            url: 'https://jobs.lever.co/acme/1',
            resume_id: 'resume-1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'cover-1' }] })
      .mockResolvedValueOnce({ rows: [{ label: 'Authorized?', answer: 'Yes' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            resume_id: 'resume-1',
            url: 'https://jobs.lever.co/acme/1',
            status: 'applied',
            tailored_count: 1,
            cover_letter_count: 1,
            receipt_count: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'receipt-1',
            job_id: 'job-1',
            queue_id: 'queue-1',
            provider: 'lever',
            status: 'submitted',
            fields_json: '[{"label":"Authorized?","value":"Yes","source":"profile"}]',
            resume_id: 'resume-1',
            cover_letter_id: 'cover-1',
            confirmation_text: 'Submitted',
            confirmation_url: null,
            failure_reason: null,
            created_at: 3,
          },
        ],
      });

    const { POST } = await import('@/app/api/apply-agent/receipts/route');
    const res = await POST(
      makeReq('https://rolepatch.com/api/apply-agent/receipts', {
        queue_id: 'queue-1',
        confirmation_text: 'Submitted',
      }) as Parameters<typeof ReceiptsRoute.POST>[0]
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.receipt.status).toBe('submitted');
    expect(json.receipt.fields[0].label).toBe('Authorized?');
  });
});
