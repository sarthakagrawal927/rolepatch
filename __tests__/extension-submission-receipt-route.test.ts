import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SubmissionReceiptRoute from '@/app/api/extension/submission-receipt/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/extension/submission-receipt', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<(typeof SubmissionReceiptRoute)['POST']>[0];
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  vi.resetModules();
});

describe('POST /api/extension/submission-receipt', () => {
  it('rejects signed-out requests', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/extension/submission-receipt/route');
    const res = await POST(
      makeReq({ job_id: 'job-1', confirmation_url: 'https://boards.greenhouse.io/thanks' })
    );
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('records a submitted receipt and marks the queue submitted', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            url: 'https://boards.greenhouse.io/acme/jobs/1',
            resume_id: 'resume-1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'queue-1',
            readiness_json: JSON.stringify({
              status: 'ready_for_review',
              summary: 'Ready',
              missing: [],
              checks: {
                resume: true,
                tailored_resume: true,
                cover_letter: true,
                profile_answers: true,
                receipt: false,
              },
            }),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'cover-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/extension/submission-receipt/route');
    const res = await POST(
      makeReq({
        job_id: 'job-1',
        original_url: 'https://boards.greenhouse.io/acme/jobs/1',
        confirmation_url: 'https://boards.greenhouse.io/acme/confirmation',
        confirmation_text: 'Thanks for applying to Acme.',
        provider: 'greenhouse',
        fields: [
          { label: 'Work authorization', value: 'Yes', source: 'ats' },
          { label: 'Ignored empty', value: '', source: 'ats' },
          { label: 'Resume upload', value: 'resume.pdf', source: 'ats' },
        ],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.learned_profile_answers).toBe(1);

    const insertCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO application_receipts')
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall?.[0].args[5]).toBe('submitted');
    expect(JSON.parse(insertCall?.[0].args[6])).toEqual(
      expect.arrayContaining([
        {
          label: 'Confirmation URL',
          value: 'https://boards.greenhouse.io/acme/confirmation',
          source: 'ats',
        },
        {
          label: 'Work authorization',
          value: 'Yes',
          source: 'ats',
        },
      ])
    );

    const jobUpdateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes("SET status = 'applied'")
    );
    expect(jobUpdateCall).toBeTruthy();

    const queueUpdateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('UPDATE application_queue')
    );
    expect(queueUpdateCall).toBeTruthy();
    expect(queueUpdateCall?.[0].args[0]).toBe('submitted');

    const learnedCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO profile_answers')
    );
    expect(learnedCall).toBeTruthy();
    expect(learnedCall?.[0].args.slice(2)).toEqual([
      'work_authorization',
      'Work authorization',
      'Yes',
    ]);
  });

  it('updates an existing learned profile answer by label', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            url: 'https://jobs.lever.co/acme/1',
            resume_id: 'resume-1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'answer-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/extension/submission-receipt/route');
    const res = await POST(
      makeReq({
        job_id: 'job-1',
        original_url: 'https://jobs.lever.co/acme/1',
        confirmation_url: 'https://jobs.lever.co/acme/confirmation',
        confirmation_text: 'Thanks.',
        fields: [{ label: 'Need visa sponsorship?', value: 'No', source: 'ats' }],
      })
    );

    expect(res.status).toBe(200);
    expect((await res.json()).learned_profile_answers).toBe(1);
    const updateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('UPDATE profile_answers')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[0].args).toEqual(['sponsorship', 'No', 'answer-1', 'user-1']);
  });

  it('records a failed reviewed submit without marking the job applied', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'job-1',
            url: 'https://jobs.lever.co/acme/1',
            resume_id: 'resume-1',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'queue-1',
            readiness_json: JSON.stringify({
              status: 'ready_for_review',
              summary: 'Ready',
              missing: [],
              checks: {
                resume: true,
                tailored_resume: true,
                cover_letter: true,
                profile_answers: true,
                receipt: false,
              },
            }),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'cover-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/extension/submission-receipt/route');
    const res = await POST(
      makeReq({
        job_id: 'job-1',
        original_url: 'https://jobs.lever.co/acme/1',
        confirmation_url: 'https://jobs.lever.co/acme/1',
        confirmation_text: 'Please complete all required fields.',
        provider: 'lever',
        status: 'failed',
        failure_reason: 'No confirmation page detected after reviewed submit.',
        mode: 'Extension reviewed submit',
      })
    );
    expect(res.status).toBe(200);

    const insertCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO application_receipts')
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall?.[0].args[5]).toBe('failed');
    expect(insertCall?.[0].args[11]).toBe('No confirmation page detected after reviewed submit.');

    const jobUpdateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes("SET status = 'applied'")
    );
    expect(jobUpdateCall).toBeFalsy();

    const queueUpdateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('UPDATE application_queue')
    );
    expect(queueUpdateCall).toBeTruthy();
    expect(queueUpdateCall?.[0].args[0]).toBe('failed');
    expect(JSON.parse(queueUpdateCall?.[0].args[1]).summary).toContain(
      'Reviewed submit needs attention'
    );
  });
});
