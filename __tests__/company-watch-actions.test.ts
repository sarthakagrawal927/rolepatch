import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

const mockDiscoverCompanyCareerJobs = vi.fn();
vi.mock('@/lib/company-career-watch', () => ({
  discoverCompanyCareerJobs: (...args: unknown[]) => mockDiscoverCompanyCareerJobs(...args),
}));

const mockSearchJobs = vi.fn();
vi.mock('@/lib/job-search', () => ({
  searchJobs: (...args: unknown[]) => mockSearchJobs(...args),
}));

vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => Promise.resolve('user-1'),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

function watch() {
  return {
    id: 'watch-1',
    company: 'Acme',
    career_url: 'https://boards.greenhouse.io/acme',
    role_query: 'engineer',
    location: '',
    remote: false,
    paused: false,
    last_run_at: null,
    last_result_ids: [],
    last_source: null,
    last_found_count: null,
    last_error: null,
    created_at: 1,
    updated_at: 1,
  };
}

beforeEach(() => {
  mockExecute.mockReset();
  mockDiscoverCompanyCareerJobs.mockReset();
  mockSearchJobs.mockReset();
  vi.resetModules();
});

describe('runCompanyWatchForUser', () => {
  it('stores career adapter source and found count', async () => {
    mockDiscoverCompanyCareerJobs.mockResolvedValue({
      source: 'greenhouse',
      jobs: [
        {
          id: 'job-1',
          title: 'Engineer',
          company: 'Acme',
          location: 'Remote',
          job_url: 'https://boards.greenhouse.io/acme/jobs/1',
        },
      ],
    });
    mockExecute.mockResolvedValue({ rows: [] });

    const { runCompanyWatchForUser } = await import('@/lib/actions/job-discovery-actions');
    const count = await runCompanyWatchForUser(watch(), 'user-1');

    expect(count).toBe(1);
    expect(mockSearchJobs).not.toHaveBeenCalled();
    const insertCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO job_discovery_alerts')
    );
    expect(insertCall?.[0].args).toEqual([
      expect.any(String),
      'user-1',
      'Engineer',
      'Acme · Remote',
      'job-1',
      'Acme',
      'https://boards.greenhouse.io/acme/jobs/1',
      'Remote',
      'greenhouse',
    ]);
    const updateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('UPDATE company_watches')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[0].args).toEqual([
      JSON.stringify(['job-1']),
      'greenhouse',
      1,
      null,
      'watch-1',
      'user-1',
    ]);
  });

  it('falls back to LinkedIn and stores the adapter error', async () => {
    mockDiscoverCompanyCareerJobs.mockRejectedValue(new Error('Career source returned HTTP 404'));
    mockSearchJobs.mockResolvedValue({
      jobs: [
        {
          id: 'linkedin-1',
          title: 'Engineer',
          company: 'Acme',
          location: 'Remote',
          job_url: 'https://linkedin.com/jobs/view/1',
        },
      ],
    });
    mockExecute.mockResolvedValue({ rows: [] });

    const { runCompanyWatchForUser } = await import('@/lib/actions/job-discovery-actions');
    const count = await runCompanyWatchForUser(watch(), 'user-1');

    expect(count).toBe(1);
    expect(mockSearchJobs).toHaveBeenCalledWith({
      query: 'Acme engineer',
      location: null,
      remote: false,
      results_wanted: 25,
      hours_old: 168,
    });
    const updateCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('UPDATE company_watches')
    );
    expect(updateCall?.[0].args).toEqual([
      JSON.stringify(['linkedin-1']),
      'linkedin_fallback',
      1,
      'Career source returned HTTP 404',
      'watch-1',
      'user-1',
    ]);
  });

  it('stores every new company-watch job instead of only the first ten', async () => {
    mockDiscoverCompanyCareerJobs.mockResolvedValue({
      source: 'ashby',
      jobs: Array.from({ length: 12 }, (_, index) => ({
        id: `job-${index}`,
        title: `Engineer ${index}`,
        company: 'Acme',
        location: 'Remote',
        job_url: `https://jobs.ashbyhq.com/acme/${index}`,
      })),
    });
    mockExecute.mockResolvedValue({ rows: [] });

    const { runCompanyWatchForUser } = await import('@/lib/actions/job-discovery-actions');
    const count = await runCompanyWatchForUser(watch(), 'user-1');

    const insertCalls = mockExecute.mock.calls.filter(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO job_discovery_alerts')
    );
    expect(count).toBe(12);
    expect(insertCalls).toHaveLength(12);
  });

  it('stores saved-search alert metadata for actionable queue import', async () => {
    mockExecute.mockImplementation((arg) => {
      if (String((arg as { sql?: string }).sql).includes('SELECT last_result_ids')) {
        return Promise.resolve({ rows: [{ last_result_ids: '[]' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const { recordSavedSearchRun } = await import('@/lib/actions/job-discovery-actions');
    const count = await recordSavedSearchRun('search-1', [
      {
        id: 'job-1',
        title: 'Platform Engineer',
        company: 'Acme',
        location: 'Remote',
        job_url: 'https://jobs.lever.co/acme/1',
        site: 'lever',
      },
    ]);

    expect(count).toBe(1);
    const insertCall = mockExecute.mock.calls.find(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO job_discovery_alerts')
    );
    expect(insertCall?.[0].args).toEqual([
      expect.any(String),
      'user-1',
      'Platform Engineer',
      'Acme · Remote',
      'job-1',
      'Acme',
      'https://jobs.lever.co/acme/1',
      'Remote',
      'lever',
    ]);
  });

  it('stores every new saved-search job instead of only the first ten', async () => {
    mockExecute.mockImplementation((arg) => {
      if (String((arg as { sql?: string }).sql).includes('SELECT last_result_ids')) {
        return Promise.resolve({ rows: [{ last_result_ids: '[]' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const { recordSavedSearchRun } = await import('@/lib/actions/job-discovery-actions');
    const jobs = Array.from({ length: 12 }, (_, index) => ({
      id: `job-${index}`,
      title: `Platform Engineer ${index}`,
      company: 'Acme',
      location: 'Remote',
      job_url: `https://jobs.lever.co/acme/${index}`,
      site: 'lever',
    }));
    const count = await recordSavedSearchRun('search-1', jobs);

    const insertCalls = mockExecute.mock.calls.filter(([arg]) =>
      String((arg as { sql?: string }).sql).includes('INSERT INTO job_discovery_alerts')
    );
    expect(count).toBe(12);
    expect(insertCalls).toHaveLength(12);
  });
});
