import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the auth helper — unauthenticated by default
const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
vi.mock('@/lib/auth-utils', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

// Mock the DB so we can detect unwanted writes
const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  db: { execute: (...args: unknown[]) => mockExecute(...args) },
}));

// Next helpers that server actions import
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}));

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [] });
});

describe('job-actions auth guards', () => {
  it('createJobApplication throws when signed out', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { createJobApplication } = await import('@/lib/actions/job-actions');
    await expect(
      createJobApplication('r', 'https://x.com', 'Co', 'Role', 'raw', 'text')
    ).rejects.toThrow(/sign in/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('saveTailoredResume throws when signed out', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { saveTailoredResume } = await import('@/lib/actions/job-actions');
    await expect(saveTailoredResume('j', 'r', 'src')).rejects.toThrow(/sign in/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('getJobApplication returns null when signed out (no DB read)', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { getJobApplication } = await import('@/lib/actions/job-actions');
    expect(await getJobApplication('some-id')).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('listJobApplications returns [] when signed out (no DB read)', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { listJobApplications } = await import('@/lib/actions/job-actions');
    expect(await listJobApplications()).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('getTailoredResumes returns [] when signed out (no DB read)', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { getTailoredResumes } = await import('@/lib/actions/job-actions');
    expect(await getTailoredResumes('job-id')).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe('cover-letter-action auth guards', () => {
  it('getCoverLetter returns null when signed out (no DB read)', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { getCoverLetter } = await import('@/lib/actions/cover-letter-action');
    expect(await getCoverLetter('job-id')).toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('updateCoverLetter throws when signed out', async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const { updateCoverLetter } = await import('@/lib/actions/cover-letter-action');
    await expect(updateCoverLetter('id', 'new content')).rejects.toThrow(/sign in/i);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

describe('scrape-action SSRF guards', () => {
  it('rejects non-http protocols', async () => {
    mockGetCurrentUserId.mockResolvedValue(`user-${Math.random()}`);
    const { scrapeJobUrl } = await import('@/lib/actions/scrape-action');
    await expect(scrapeJobUrl('file:///etc/passwd')).rejects.toThrow(/http/i);
    await expect(scrapeJobUrl('ftp://example.com')).rejects.toThrow(/http/i);
  });

  it('rejects localhost and loopback', async () => {
    mockGetCurrentUserId.mockResolvedValue(`user-${Math.random()}`);
    const { scrapeJobUrl } = await import('@/lib/actions/scrape-action');
    await expect(scrapeJobUrl('http://localhost/x')).rejects.toThrow(/internal/i);
    await expect(scrapeJobUrl('http://127.0.0.1/x')).rejects.toThrow(/internal/i);
    await expect(scrapeJobUrl('http://0.0.0.0/x')).rejects.toThrow(/internal/i);
    await expect(scrapeJobUrl('http://[::1]/x')).rejects.toThrow(/internal/i);
  });

  it('rejects private IP ranges', async () => {
    mockGetCurrentUserId.mockResolvedValue(`user-${Math.random()}`);
    const { scrapeJobUrl } = await import('@/lib/actions/scrape-action');
    await expect(scrapeJobUrl('http://10.0.0.1/x')).rejects.toThrow(/internal/i);
    await expect(scrapeJobUrl('http://172.16.0.1/x')).rejects.toThrow(/internal/i);
    await expect(scrapeJobUrl('http://192.168.1.1/x')).rejects.toThrow(/internal/i);
  });

  it('rejects cloud metadata endpoint (169.254.169.254)', async () => {
    mockGetCurrentUserId.mockResolvedValue(`user-${Math.random()}`);
    const { scrapeJobUrl } = await import('@/lib/actions/scrape-action');
    await expect(scrapeJobUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /internal/i
    );
  });

  it('rejects malformed URLs', async () => {
    mockGetCurrentUserId.mockResolvedValue(`user-${Math.random()}`);
    const { scrapeJobUrl } = await import('@/lib/actions/scrape-action');
    await expect(scrapeJobUrl('not a url')).rejects.toThrow(/invalid/i);
  });
});
