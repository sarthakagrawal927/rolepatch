import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobBrowser } from '@/components/job-browser';

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ isGuest: true }),
}));

vi.mock('@/components/job-discovery', () => ({
  JobDiscovery: ({ resumes }: { resumes: Array<{ id: string; name: string }> }) => (
    <div data-testid="job-discovery">{resumes.map((resume) => resume.name).join(', ')}</div>
  ),
}));

vi.mock('@/components/job-search-tips', () => ({
  JobSearchTips: () => <div>Search tips</div>,
}));

const mockLocalListResumes = vi.fn();
vi.mock('@/lib/local-storage', () => ({
  localListResumes: () => mockLocalListResumes(),
}));

beforeEach(() => {
  mockLocalListResumes.mockReset();
});

describe('JobBrowser', () => {
  it('hydrates guest resumes before rendering discovery actions', async () => {
    mockLocalListResumes.mockReturnValue([
      {
        id: 'resume-local',
        name: 'Local Resume',
        source: '# Resume',
        created_at: 1,
        updated_at: 1,
      },
    ]);

    render(<JobBrowser serverResumes={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('job-discovery').textContent).toContain('Local Resume');
    });
    expect(screen.getByText('Search tips')).toBeDefined();
  });
});
