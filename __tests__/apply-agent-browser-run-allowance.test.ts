import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecute = vi.fn();

vi.mock('@/lib/db', () => ({
  db: { execute: mockExecute },
}));

function dbResult(rows: unknown[]) {
  return { rows };
}

const safeAnswers = [
  { category: 'work_authorization', label: 'Authorized to work?', answer: 'Yes' },
  { category: 'sponsorship', label: 'Need sponsorship?', answer: 'No' },
];

function readyQueueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'queue-1',
    job_id: 'job-1',
    readiness_json: '{}',
    url: 'https://boards.greenhouse.io/acme/jobs/1',
    company: 'Acme',
    resume_id: 'resume-1',
    ...overrides,
  };
}

function mockOpenAllowanceAndQueue(input: {
  answers?: unknown[];
  queue?: unknown[];
  fitScore?: number | null;
  jobUrls?: unknown[];
}) {
  mockExecute.mockImplementation(({ sql }: { sql: string }) => {
    if (sql.includes('FROM profile_answers')) {
      return Promise.resolve(dbResult(input.answers ?? safeAnswers));
    }
    if (sql.includes('FROM application_receipts')) {
      return Promise.resolve(dbResult([{ count: 0 }]));
    }
    if (sql.includes('JOIN job_applications')) {
      return Promise.resolve(dbResult(input.queue ?? [readyQueueRow()]));
    }
    if (sql.includes('FROM fit_scores')) {
      return Promise.resolve(
        dbResult(input.fitScore == null ? [] : [{ overall_score: input.fitScore }])
      );
    }
    if (sql.includes('FROM job_applications') && sql.includes('url IS NOT NULL')) {
      return Promise.resolve(
        dbResult(
          input.jobUrls ?? [{ id: 'job-1', url: 'https://boards.greenhouse.io/acme/jobs/1' }]
        )
      );
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
}

beforeEach(() => {
  mockExecute.mockReset();
  vi.resetModules();
});

describe('guarded browser submit allowance', () => {
  it('stops single guarded submit before queue lookup when the daily cap is reached', async () => {
    mockExecute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes('FROM profile_answers')) {
        return Promise.resolve(
          dbResult([{ label: 'Daily guarded submit cap', answer: '1 application per day' }])
        );
      }
      if (sql.includes('FROM application_receipts')) {
        return Promise.resolve(dbResult([{ count: 1 }]));
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const { runGuardedApplyBrowserSubmitForUser } = await import('@/lib/apply-agent-browser-run');

    await expect(runGuardedApplyBrowserSubmitForUser('user-1', 'queue-1')).rejects.toThrow(
      /Daily guarded submit cap reached \(1\/1\)/i
    );

    expect(mockExecute).toHaveBeenCalledTimes(2);
    expect(
      mockExecute.mock.calls.some(([query]) => String(query.sql).includes('application_queue'))
    ).toBe(false);
  });

  it('trims server-side batch selection to the remaining daily allowance', async () => {
    mockExecute.mockImplementation(({ sql, args }: { sql: string; args: unknown[] }) => {
      if (sql.includes('FROM profile_answers')) {
        return Promise.resolve(dbResult([{ label: 'Daily guarded submit cap', answer: '2' }]));
      }
      if (sql.includes('FROM application_receipts')) {
        return Promise.resolve(dbResult([{ count: 1 }]));
      }
      if (
        sql.includes('FROM application_queue') &&
        sql.includes("status = 'ready_to_submit'") &&
        sql.includes('ORDER BY updated_at DESC')
      ) {
        expect(args[1]).toBe(1);
        return Promise.resolve(dbResult([{ id: 'queue-1' }]));
      }
      if (sql.includes('JOIN job_applications')) {
        return Promise.resolve(dbResult([]));
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const { runGuardedApplyBrowserSubmitBatchForUser } = await import(
      '@/lib/apply-agent-browser-run'
    );

    const result = await runGuardedApplyBrowserSubmitBatchForUser('user-1', { limit: 5 });

    expect(result.requested).toBe(1);
    expect(result.processed).toBe(0);
    expect(result.errors).toEqual([
      { queue_id: 'queue-1', error: 'Queued application is not ready for guarded submit' },
    ]);
  });

  it('stops guarded submit when required profile answers are missing', async () => {
    mockOpenAllowanceAndQueue({
      answers: [{ category: 'work_authorization', label: 'Authorized to work?', answer: 'Yes' }],
    });

    const { runGuardedApplyBrowserSubmitForUser } = await import('@/lib/apply-agent-browser-run');

    await expect(runGuardedApplyBrowserSubmitForUser('user-1', 'queue-1')).rejects.toThrow(
      /Required answers missing \(Sponsorship\)/i
    );
  });

  it('stops guarded submit for excluded companies before browser work', async () => {
    mockOpenAllowanceAndQueue({
      answers: [
        ...safeAnswers,
        { category: 'other', label: 'Excluded companies', answer: 'Acme, Beta Labs' },
      ],
    });

    const { runGuardedApplyBrowserSubmitForUser } = await import('@/lib/apply-agent-browser-run');

    await expect(runGuardedApplyBrowserSubmitForUser('user-1', 'queue-1')).rejects.toThrow(
      /Excluded company matches saved exclusion "acme"/i
    );
  });

  it('stops guarded submit for duplicate normalized ATS URLs', async () => {
    mockOpenAllowanceAndQueue({
      jobUrls: [
        { id: 'job-1', url: 'https://boards.greenhouse.io/acme/jobs/1?utm=rolepatch' },
        { id: 'job-2', url: 'https://boards.greenhouse.io/acme/jobs/1' },
      ],
    });

    const { runGuardedApplyBrowserSubmitForUser } = await import('@/lib/apply-agent-browser-run');

    await expect(runGuardedApplyBrowserSubmitForUser('user-1', 'queue-1')).rejects.toThrow(
      /Duplicate job URL/i
    );
  });

  it('stops guarded submit below the saved minimum fit score', async () => {
    mockOpenAllowanceAndQueue({
      answers: [...safeAnswers, { category: 'other', label: 'Minimum fit score', answer: '80' }],
      fitScore: 72,
    });

    const { runGuardedApplyBrowserSubmitForUser } = await import('@/lib/apply-agent-browser-run');

    await expect(runGuardedApplyBrowserSubmitForUser('user-1', 'queue-1')).rejects.toThrow(
      /Fit score is 72; minimum is 80/i
    );
  });
});
