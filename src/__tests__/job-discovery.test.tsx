import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobDiscovery } from '@/components/job-discovery';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ isGuest: true }),
}));

const mockQueueApplication = vi.fn();
vi.mock('@/lib/actions/apply-agent-actions', () => ({
  queueApplication: (...args: unknown[]) => mockQueueApplication(...args),
}));

const mockCreateJobApplication = vi.fn();
vi.mock('@/lib/actions/job-actions', () => ({
  createJobApplication: (...args: unknown[]) => mockCreateJobApplication(...args),
}));

vi.mock('@/lib/actions/job-discovery-actions', () => ({
  addSavedJobShortlist: vi.fn(),
  createCompanyWatch: vi.fn(),
  createSavedJobSearch: vi.fn(),
  deleteCompanyWatch: vi.fn(),
  deleteSavedJobSearch: vi.fn(),
  listCompanyWatches: vi.fn(),
  listJobDiscoveryAlerts: vi.fn(),
  listSavedJobSearches: vi.fn(),
  listSavedJobShortlist: vi.fn(),
  markJobDiscoveryAlertsSeen: vi.fn(),
  recordSavedSearchRun: vi.fn(),
  removeSavedJobShortlist: vi.fn(),
  runCompanyWatch: vi.fn(),
  updateCompanyWatch: vi.fn(),
  updateSavedJobSearch: vi.fn(),
}));

const mockRankDiscoveredJobsByResumeSimilarity = vi.fn();
vi.mock('@/lib/actions/job-discovery-similarity-actions', () => ({
  rankDiscoveredJobsByResumeSimilarity: (...args: unknown[]) =>
    mockRankDiscoveredJobsByResumeSimilarity(...args),
}));

const mockLocalSaveJob = vi.fn();
const mockLocalQueueApplication = vi.fn();
vi.mock('@/lib/local-storage', () => ({
  localAddJobDiscoveryAlert: vi.fn(),
  localAddSavedJobShortlist: vi.fn(),
  localCreateSavedJobSearch: vi.fn(),
  localDeleteSavedJobSearch: vi.fn(),
  localListJobDiscoveryAlerts: vi.fn(() => []),
  localListSavedJobSearches: vi.fn(() => []),
  localListSavedJobShortlist: vi.fn(() => []),
  localMarkJobDiscoveryAlertsSeen: vi.fn(),
  localRemoveSavedJobShortlist: vi.fn(),
  localQueueApplication: (...args: unknown[]) => mockLocalQueueApplication(...args),
  localSaveJob: (...args: unknown[]) => mockLocalSaveJob(...args),
  localUpdateSavedJobSearch: vi.fn(),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockQueueApplication.mockReset();
  mockCreateJobApplication.mockReset();
  mockLocalSaveJob.mockReset();
  mockLocalQueueApplication.mockReset();
  mockRankDiscoveredJobsByResumeSimilarity.mockReset();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('guest-job-1');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        jobs: [
          {
            id: 'job-1',
            site: 'linkedin',
            title: 'Founding Product Engineer',
            company: 'Acme',
            location: 'Remote',
            is_remote: true,
            job_url: 'https://www.linkedin.com/jobs/view/123',
            description_short: 'Build applied AI workflows for job seekers.',
          },
        ],
      })
    )
  );
});

describe('JobDiscovery', () => {
  it('runs quick searches through the existing job search API', async () => {
    const user = userEvent.setup();

    render(<JobDiscovery resumes={[{ id: 'resume-1', name: 'Base Resume' }]} />);

    await user.click(screen.getByText('Remote AI engineer'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/jobs/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            query: 'AI engineer',
            location: 'Remote',
            remote: true,
            results_wanted: 25,
          }),
        })
      );
    });
    expect(await screen.findByText('Founding Product Engineer')).toBeDefined();
    expect(screen.getAllByText('Remote').length).toBeGreaterThanOrEqual(2);
  });

  it('queues all visible discovered jobs for reviewed apply prep', async () => {
    const user = userEvent.setup();
    const onQueueDiscoveredJob = vi.fn(async () => {});
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        jobs: [
          {
            id: 'job-1',
            site: 'linkedin',
            title: 'Founding Product Engineer',
            company: 'Acme',
            location: 'Remote',
            is_remote: true,
            job_url: 'https://www.linkedin.com/jobs/view/123',
            description_short: 'Build applied AI workflows for job seekers.',
          },
          {
            id: 'job-2',
            site: 'linkedin',
            title: 'AI Platform Engineer',
            company: 'Beta',
            location: 'New York',
            is_remote: false,
            job_url: 'https://www.linkedin.com/jobs/view/456',
            description_short: 'Own reliable model-serving infrastructure.',
          },
          {
            id: 'job-2-duplicate',
            site: 'linkedin',
            title: 'AI Platform Engineer duplicate',
            company: 'Beta',
            location: 'New York',
            is_remote: false,
            job_url: 'https://www.linkedin.com/jobs/view/456?tracking=duplicate',
            description_short: 'Duplicate result with tracking params.',
          },
        ],
      })
    );

    render(
      <JobDiscovery
        resumes={[
          {
            id: 'resume-1',
            name: 'Base Resume',
            source: '# Resume\nBuilt RAG semantic search systems with React dashboards.',
          },
        ]}
        onQueueDiscoveredJob={onQueueDiscoveredJob}
      />
    );

    await user.type(screen.getByPlaceholderText('python engineer, staff PM, ...'), 'ai engineer');
    await user.click(screen.getByText('Discover jobs'));
    await user.click(await screen.findByText('Queue 2 for review'));

    await waitFor(() => {
      expect(onQueueDiscoveredJob).toHaveBeenCalledTimes(2);
    });
    expect(onQueueDiscoveredJob).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'job-1' }),
      'resume-1'
    );
    expect(onQueueDiscoveredJob).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'job-2' }),
      'resume-1'
    );
    expect(await screen.findByText('All visible queued')).toBeDefined();
    expect(await screen.findByText('Queued 2 jobs for reviewed apply prep.')).toBeDefined();
  });

  it('filters discovered jobs by signal before batch queueing', async () => {
    const user = userEvent.setup();
    const onQueueDiscoveredJob = vi.fn(async () => {});
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        jobs: [
          {
            id: 'job-1',
            site: 'linkedin',
            title: 'Founding Product Engineer',
            company: 'Acme',
            location: 'Remote',
            is_remote: true,
            job_url: 'https://www.linkedin.com/jobs/view/123',
            description_short: 'Build applied AI workflows for job seekers.',
          },
          {
            id: 'job-2',
            site: 'linkedin',
            title: 'AI Platform Engineer',
            company: 'Beta',
            location: 'New York',
            is_remote: false,
            job_url: 'https://www.linkedin.com/jobs/view/456',
            description_short: 'Own reliable model-serving infrastructure with H-1B sponsorship.',
          },
          {
            id: 'job-3',
            site: 'linkedin',
            title: 'Junior AI Engineer',
            company: 'Cobalt',
            location: 'San Francisco',
            is_remote: false,
            job_url: 'https://www.linkedin.com/jobs/view/789',
            description_short: 'Entry-level role for early career engineers.',
          },
        ],
      })
    );

    render(
      <JobDiscovery
        resumes={[{ id: 'resume-1', name: 'Base Resume' }]}
        onQueueDiscoveredJob={onQueueDiscoveredJob}
      />
    );

    await user.type(screen.getByPlaceholderText('python engineer, staff PM, ...'), 'ai engineer');
    await user.click(screen.getByText('Discover jobs'));
    await user.click(await screen.findByRole('button', { name: 'Visa signal' }));

    expect(await screen.findByText('1 of 3 matches shown')).toBeDefined();
    await user.click(screen.getByText('Queue 1 for review'));

    await waitFor(() => {
      expect(onQueueDiscoveredJob).toHaveBeenCalledTimes(1);
    });
    expect(onQueueDiscoveredJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-2' }),
      'resume-1'
    );

    await user.click(screen.getByText('Clear filters'));
    expect(await screen.findByText('3 matches found')).toBeDefined();
  });

  it('ranks discovered jobs by resume similarity before review queueing', async () => {
    const user = userEvent.setup();
    const onQueueDiscoveredJob = vi.fn(async () => {});
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        jobs: [
          {
            id: 'job-1',
            site: 'linkedin',
            title: 'Frontend Engineer',
            company: 'Acme',
            location: 'Remote',
            is_remote: true,
            job_url: 'https://www.linkedin.com/jobs/view/123',
            description_short: 'React accessibility dashboards.',
          },
          {
            id: 'job-2',
            site: 'linkedin',
            title: 'AI Product Engineer',
            company: 'Beta',
            location: 'New York',
            is_remote: false,
            job_url: 'https://www.linkedin.com/jobs/view/456',
            description_short: 'Build RAG workflows and semantic search products.',
          },
        ],
      })
    );
    mockRankDiscoveredJobsByResumeSimilarity.mockResolvedValueOnce({
      status: 'ranked',
      orderedIds: ['job-2', 'job-1'],
      rankedCount: 2,
      scoresById: { 'job-2': 92, 'job-1': 81 },
      matchTermsById: { 'job-2': ['RAG', 'Semantic', 'Search'] },
    });

    render(
      <JobDiscovery
        resumes={[{ id: 'resume-1', name: 'Base Resume' }]}
        onQueueDiscoveredJob={onQueueDiscoveredJob}
      />
    );

    await user.type(screen.getByPlaceholderText('python engineer, staff PM, ...'), 'ai engineer');
    await user.click(screen.getByText('Discover jobs'));
    await user.click(await screen.findByRole('button', { name: 'Rank by resume match' }));

    await waitFor(() => {
      expect(mockRankDiscoveredJobsByResumeSimilarity).toHaveBeenCalledWith(
        'resume-1',
        expect.arrayContaining([
          expect.objectContaining({ id: 'job-1' }),
          expect.objectContaining({ id: 'job-2' }),
        ])
      );
    });
    expect(await screen.findByText('Ranked 2 matches by resume similarity.')).toBeDefined();
    expect(await screen.findByText('Semantic match 92%')).toBeDefined();
    expect(await screen.findByText('Why matched: RAG, Semantic, Search')).toBeDefined();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    ).toEqual(['AI Product Engineer', 'Frontend Engineer']);

    await user.click(screen.getByRole('button', { name: '90%+' }));
    expect(await screen.findByText('1 of 2 matches shown')).toBeDefined();
    await user.click(screen.getByText('Queue 1 for review'));

    await waitFor(() => {
      expect(onQueueDiscoveredJob).toHaveBeenCalledTimes(1);
    });
    expect(onQueueDiscoveredJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-2' }),
      'resume-1',
      { semanticScore: 92, matchTerms: ['RAG', 'Semantic', 'Search'] }
    );
  });

  it('queues only strong semantic matches for reviewed apply prep', async () => {
    const user = userEvent.setup();
    const onQueueDiscoveredJob = vi.fn(async () => {});
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        jobs: [
          {
            id: 'job-1',
            site: 'linkedin',
            title: 'Frontend Engineer',
            company: 'Acme',
            location: 'Remote',
            is_remote: true,
            job_url: 'https://www.linkedin.com/jobs/view/123',
            description_short: 'React accessibility dashboards.',
          },
          {
            id: 'job-2',
            site: 'linkedin',
            title: 'AI Product Engineer',
            company: 'Beta',
            location: 'New York',
            is_remote: false,
            job_url: 'https://www.linkedin.com/jobs/view/456',
            description_short: 'Build RAG workflows and semantic search products.',
          },
          {
            id: 'job-3',
            site: 'linkedin',
            title: 'Analytics Engineer',
            company: 'Cobalt',
            location: 'Austin',
            is_remote: false,
            job_url: 'https://www.linkedin.com/jobs/view/789',
            description_short: 'Maintain finance reporting pipelines.',
          },
        ],
      })
    );
    mockRankDiscoveredJobsByResumeSimilarity.mockResolvedValueOnce({
      status: 'ranked',
      orderedIds: ['job-2', 'job-1', 'job-3'],
      rankedCount: 3,
      scoresById: { 'job-2': 93, 'job-1': 82, 'job-3': 64 },
      matchTermsById: { 'job-2': ['RAG', 'Semantic'] },
    });

    render(
      <JobDiscovery
        resumes={[{ id: 'resume-1', name: 'Base Resume' }]}
        onQueueDiscoveredJob={onQueueDiscoveredJob}
      />
    );

    await user.type(screen.getByPlaceholderText('python engineer, staff PM, ...'), 'ai engineer');
    await user.click(screen.getByText('Discover jobs'));
    await user.click(await screen.findByRole('button', { name: 'Rank by resume match' }));
    await user.click(await screen.findByRole('button', { name: 'Queue 2 strong matches' }));

    await waitFor(() => {
      expect(onQueueDiscoveredJob).toHaveBeenCalledTimes(2);
    });
    expect(onQueueDiscoveredJob).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'job-2' }),
      'resume-1',
      { semanticScore: 93, matchTerms: ['RAG', 'Semantic'] }
    );
    expect(onQueueDiscoveredJob).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'job-1' }),
      'resume-1',
      { semanticScore: 82, matchTerms: undefined }
    );
    expect(
      await screen.findByText('Queued 2 strong resume matches for reviewed apply prep.')
    ).toBeDefined();
  });

  it('queues discovered jobs through the dashboard apply-agent handler', async () => {
    const user = userEvent.setup();
    const onQueueDiscoveredJob = vi.fn(async () => {});

    render(
      <JobDiscovery
        resumes={[{ id: 'resume-1', name: 'Base Resume' }]}
        onQueueDiscoveredJob={onQueueDiscoveredJob}
      />
    );

    await user.type(screen.getByPlaceholderText('python engineer, staff PM, ...'), 'ai engineer');
    await user.click(screen.getByText('Discover jobs'));
    await user.click(await screen.findByText('Queue for review'));

    await waitFor(() => {
      expect(onQueueDiscoveredJob).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-1',
          title: 'Founding Product Engineer',
          job_url: 'https://www.linkedin.com/jobs/view/123',
        }),
        'resume-1'
      );
    });
    expect(await screen.findByText('Queued')).toBeDefined();
  });

  it('lets guests search live jobs and create a local tailoring draft', async () => {
    const user = userEvent.setup();

    render(<JobDiscovery resumes={[{ id: 'resume-1', name: 'Base Resume' }]} />);

    expect(screen.queryByText('Sign in to discover jobs')).toBeNull();
    expect(screen.getByText('Daily company watches require sign in')).toBeDefined();

    await user.type(screen.getByPlaceholderText('python engineer, staff PM, ...'), 'ai engineer');
    await user.click(screen.getByText('Discover jobs'));

    expect(await screen.findByText('Founding Product Engineer')).toBeDefined();

    await user.click(screen.getByText('Tailor this'));

    await waitFor(() => {
      expect(mockLocalSaveJob).toHaveBeenCalledWith(
        'guest-job-1',
        'Acme',
        'Founding Product Engineer',
        'resume-1',
        'https://www.linkedin.com/jobs/view/123',
        'Build applied AI workflows for job seekers.',
        'Build applied AI workflows for job seekers.'
      );
    });
    expect(mockCreateJobApplication).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/tailor/guest-job-1');
  });
});
