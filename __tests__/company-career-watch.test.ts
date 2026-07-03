import { afterEach, describe, expect, it, vi } from 'vitest';

import { discoverCompanyCareerJobs, supportsCareerUrl } from '@/lib/company-career-watch';
import type { CompanyWatch } from '@/lib/types';

function watch(overrides: Partial<CompanyWatch>): CompanyWatch {
  return {
    id: 'watch-1',
    company: 'Acme',
    career_url: null,
    role_query: '',
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
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('company career watch adapters', () => {
  it('detects supported career URLs', () => {
    expect(supportsCareerUrl('https://jobs.lever.co/acme')).toBe(true);
    expect(supportsCareerUrl('notaurl')).toBe(false);
    expect(supportsCareerUrl('mailto:jobs@example.com')).toBe(false);
  });

  it('loads Greenhouse board jobs and filters by role query', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      Response.json({
        jobs: [
          {
            id: 123,
            title: 'Senior Product Engineer',
            absolute_url: 'https://boards.greenhouse.io/acme/jobs/123',
            location: { name: 'Remote' },
            updated_at: '2026-07-01T00:00:00Z',
          },
          {
            id: 456,
            title: 'Account Executive',
            absolute_url: 'https://boards.greenhouse.io/acme/jobs/456',
            location: { name: 'New York' },
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await discoverCompanyCareerJobs(
      watch({
        career_url: 'https://boards.greenhouse.io/acme',
        role_query: 'product engineer',
        remote: true,
      })
    );

    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=false'
    );
    expect(result?.source).toBe('greenhouse');
    expect(result?.jobs).toHaveLength(1);
    expect(result?.jobs[0]).toMatchObject({
      title: 'Senior Product Engineer',
      site: 'greenhouse',
      is_remote: true,
    });
  });

  it('loads Lever postings API jobs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json([
          {
            id: 'abc',
            text: 'Growth Marketing Manager',
            hostedUrl: 'https://jobs.lever.co/acme/abc',
            createdAt: Date.UTC(2026, 6, 1),
            categories: { location: 'London', commitment: 'Full-time', team: 'Marketing' },
          },
        ])
      )
    );

    const result = await discoverCompanyCareerJobs(
      watch({
        career_url: 'https://jobs.lever.co/acme',
        role_query: 'marketing',
        location: 'London',
      })
    );

    expect(result?.source).toBe('lever');
    expect(result?.jobs[0]).toMatchObject({
      title: 'Growth Marketing Manager',
      site: 'lever',
      location: 'London',
      job_type: 'Full-time',
    });
  });

  it('loads Ashby public job postings and ignores unlisted roles', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      Response.json({
        apiVersion: '1',
        jobs: [
          {
            title: 'Data Platform Engineer',
            location: 'Remote',
            secondaryLocations: [{ location: 'New York' }],
            department: 'Engineering',
            team: 'Data',
            isListed: true,
            isRemote: true,
            workplaceType: 'Remote',
            descriptionPlain: 'Build data products.',
            publishedAt: '2026-07-02T00:00:00Z',
            employmentType: 'FullTime',
            jobUrl: 'https://jobs.ashbyhq.com/acme/data-platform-engineer',
            applyUrl: 'https://jobs.ashbyhq.com/acme/data-platform-engineer/application',
          },
          {
            title: 'Unlisted Role',
            isListed: false,
            jobUrl: 'https://jobs.ashbyhq.com/acme/unlisted',
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await discoverCompanyCareerJobs(
      watch({
        career_url: 'https://jobs.ashbyhq.com/acme',
        role_query: 'data engineer',
        location: 'Remote',
      })
    );

    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=false'
    );
    expect(result?.source).toBe('ashby');
    expect(result?.jobs).toHaveLength(1);
    expect(result?.jobs[0]).toMatchObject({
      title: 'Data Platform Engineer',
      site: 'ashby',
      location: 'Remote · New York',
      is_remote: true,
      job_type: 'FullTime',
      description_short: 'Engineering · Data · FullTime',
    });
  });

  it('loads Workable published jobs from the public account endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      Response.json({
        jobs: [
          {
            id: 'job-1',
            title: 'Frontend Engineer',
            state: 'published',
            department: 'Engineering',
            url: 'https://apply.workable.com/acme/j/frontend',
            created_at: '2026-07-03T00:00:00Z',
            location: {
              location_str: 'Remote',
              telecommuting: true,
              workplace_type: 'remote',
            },
            salary: {
              salary_from: 120000,
              salary_to: 150000,
              salary_currency: 'usd',
            },
          },
          {
            id: 'draft-1',
            title: 'Draft Role',
            state: 'draft',
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await discoverCompanyCareerJobs(
      watch({
        career_url: 'https://apply.workable.com/acme',
        role_query: 'frontend',
        remote: true,
      })
    );

    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://www.workable.com/api/accounts/acme?details=true'
    );
    expect(result?.source).toBe('workable');
    expect(result?.jobs).toHaveLength(1);
    expect(result?.jobs[0]).toMatchObject({
      title: 'Frontend Engineer',
      site: 'workable',
      location: 'Remote',
      is_remote: true,
      min_amount: 120000,
      max_amount: 150000,
      currency: 'usd',
    });
  });

  it('loads Recruitee published offers from the careers site API', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      Response.json({
        offers: [
          {
            id: 42,
            title: 'Customer Success Manager',
            slug: 'customer-success-manager',
            status: 'published',
            department: 'Customer',
            location: 'Berlin',
            description: 'Support customers.',
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await discoverCompanyCareerJobs(
      watch({
        career_url: 'https://acme.recruitee.com',
        role_query: 'success',
        location: 'Berlin',
      })
    );

    expect(fetchSpy.mock.calls[0][0]).toBe('https://acme.recruitee.com/api/offers/');
    expect(result?.source).toBe('recruitee');
    expect(result?.jobs[0]).toMatchObject({
      title: 'Customer Success Manager',
      site: 'recruitee',
      location: 'Berlin',
      job_url: 'https://acme.recruitee.com/o/customer-success-manager',
    });
  });

  it('loads Personio XML feed jobs', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(`
        <workzag-jobs>
          <position>
            <id>10</id>
            <name>People Operations Analyst</name>
            <office>Munich</office>
            <department>People</department>
            <employmentType>full-time</employmentType>
            <jobUrl>https://acme.jobs.personio.com/job/10</jobUrl>
          </position>
        </workzag-jobs>
      `)
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await discoverCompanyCareerJobs(
      watch({
        career_url: 'https://acme.jobs.personio.com',
        role_query: 'operations',
        location: 'Munich',
      })
    );

    expect(fetchSpy.mock.calls[0][0]).toBe('https://acme.jobs.personio.com/xml?language=en');
    expect(result?.source).toBe('personio');
    expect(result?.jobs[0]).toMatchObject({
      title: 'People Operations Analyst',
      site: 'personio',
      location: 'Munich',
      job_type: 'full-time',
      description_short: 'People · full-time',
    });
  });

  it('parses generic career page job links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(`
          <main>
            <a href="/careers/software-engineer">Software Engineer</a>
            <a href="/about">About us</a>
          </main>
        `)
      )
    );

    const result = await discoverCompanyCareerJobs(
      watch({
        career_url: 'https://example.com/careers',
        role_query: 'software',
      })
    );

    expect(result?.source).toBe('career_page');
    expect(result?.jobs).toHaveLength(1);
    expect(result?.jobs[0]).toMatchObject({
      title: 'Software Engineer',
      site: 'career_page',
      job_url: 'https://example.com/careers/software-engineer',
    });
  });
});
