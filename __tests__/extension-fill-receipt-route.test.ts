import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as FillReceiptRoute from '@/app/api/extension/fill-receipt/route';

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/extension/fill-receipt', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as unknown as Parameters<(typeof FillReceiptRoute)['POST']>[0];
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  vi.resetModules();
});

describe('POST /api/extension/fill-receipt', () => {
  it('rejects signed-out requests', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { POST } = await import('@/app/api/extension/fill-receipt/route');
    const res = await POST(makeReq({ url: 'https://jobs.lever.co/acme/1', job_id: 'job-1' }));
    expect(res.status).toBe(401);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('rejects malformed authenticated bodies before recording receipts', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    const { POST } = await import('@/app/api/extension/fill-receipt/route');

    const res = await POST(makeReq([]));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Request body must be an object' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('records a filled receipt and leaves the queue ready for user review', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [{ id: 'job-1', url: 'https://boards.greenhouse.io/acme/jobs/1', resume_id: 'r1' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'queue-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'cover-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/extension/fill-receipt/route');
    const res = await POST(
      makeReq({
        url: 'https://boards.greenhouse.io/acme/jobs/1',
        job_id: 'job-1',
        filled: 2,
        detected: 4,
        skipped: 2,
        provider: 'greenhouse',
        submit_detected: true,
        upload_fields: ['Cover letter upload'],
        uploaded_files: ['Resume upload: sarthak-resume.pdf'],
        fields: [{ label: 'Authorized?', value: 'Yes', source: 'profile' }],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.receipt_id).toMatch(/^[0-9a-f-]{36}$/);

    const insertCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO application_receipts')
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall?.[0].args[5]).toBe('filled');
    expect(JSON.parse(insertCall?.[0].args[6])).toEqual(
      expect.arrayContaining([
        { label: 'Detected provider', value: 'greenhouse', source: 'system' },
        { label: 'Submit button detected', value: 'Yes', source: 'system' },
        { label: 'Filled fields', value: '2', source: 'system' },
        {
          label: 'Manual file uploads needed',
          value: 'Cover letter upload',
          source: 'system',
        },
        {
          label: 'Files uploaded by extension',
          value: 'Resume upload: sarthak-resume.pdf',
          source: 'system',
        },
        { label: 'Authorized?', value: 'Yes', source: 'profile' },
      ])
    );

    const updateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('SET status = ?')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[0].args[0]).toBe('ready_to_submit');
  });

  it('records failed fill receipts with retryable failure reason', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1');
    mockExecute
      .mockResolvedValueOnce({
        rows: [{ id: 'job-1', url: 'https://jobs.lever.co/acme/1', resume_id: 'r1' }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'queue-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/extension/fill-receipt/route');
    const res = await POST(
      makeReq({
        url: 'https://jobs.lever.co/acme/1',
        job_id: 'job-1',
        filled: 0,
        detected: 0,
        skipped: 0,
        provider: 'lever',
        error: 'Form is no longer available',
      })
    );
    expect(res.status).toBe(200);

    const insertCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO application_receipts')
    );
    expect(insertCall?.[0].args[5]).toBe('failed');
    expect(insertCall?.[0].args[11]).toBe('Form is no longer available');

    const updateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('SET status = ?')
    );
    expect(updateCall?.[0].args[0]).toBe('failed');
  });
});
