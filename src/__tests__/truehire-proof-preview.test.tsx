import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrueHireProofPreview } from '@/components/truehire-proof-preview';
import type { AchievementEvidence } from '@/lib/types';

const mockUseAuth = vi.fn(() => ({ isGuest: false }));
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockImportTrueHireProofEvidence = vi.fn();
vi.mock('@/lib/actions/achievement-evidence-actions', () => ({
  importTrueHireProofEvidence: (...args: unknown[]) => mockImportTrueHireProofEvidence(...args),
}));

const mockLocalListAchievementEvidence = vi.fn<() => AchievementEvidence[]>(() => []);
const mockLocalCreateAchievementEvidence = vi.fn();
vi.mock('@/lib/local-storage', () => ({
  localListAchievementEvidence: () => mockLocalListAchievementEvidence(),
  localCreateAchievementEvidence: (...args: unknown[]) =>
    mockLocalCreateAchievementEvidence(...args),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mockUseAuth.mockReturnValue({ isGuest: false });
  mockImportTrueHireProofEvidence.mockReset();
  mockImportTrueHireProofEvidence.mockResolvedValue({
    handle: 'sarthak',
    imported: 1,
    skipped: 0,
  });
  mockLocalListAchievementEvidence.mockReset();
  mockLocalListAchievementEvidence.mockReturnValue([]);
  mockLocalCreateAchievementEvidence.mockReset();
});

describe('TrueHireProofPreview', () => {
  it('previews mapped TrueHire proof items without persistence controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          profile: {
            handle: 'sarthak',
            profile_url: 'https://truehire.example/@sarthak',
            overall_score: 91,
            signal1_score: 91,
            signal2_score: 0,
            last_verified_at: 1,
            public_work: {
              commits: 1200,
              repos: 18,
              stars: 400,
              months_active: 30,
            },
            verified_work_entries: 0,
          },
          items: [
            {
              id: 'truehire:sarthak:repo:sarthak/rolepatch',
              title: 'sarthak/rolepatch',
              claim: '250 commits · 4 merged PRs · 40 stars',
              source: 'truehire',
              source_label: 'TrueHire public work',
              source_url: 'https://github.com/sarthak/rolepatch',
              readiness: 'Verified public work',
              tags: ['TypeScript'],
            },
          ],
        }),
      })
    );

    render(<TrueHireProofPreview />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('TrueHire handle'), '@sarthak');
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => {
      expect(screen.getByText('sarthak/rolepatch')).toBeDefined();
    });
    expect(screen.getByText('Verified public work')).toBeDefined();
    expect(screen.getByText('TrueHire public work')).toBeDefined();
    expect(screen.getByText('91')).toBeDefined();
    expect(screen.queryByRole('button', { name: /save|attach|share/i })).toBeNull();
  });

  it('imports previewed TrueHire proof through the signed-in server action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          profile: {
            handle: 'sarthak',
            profile_url: 'https://truehire.example/@sarthak',
            overall_score: 91,
            public_work: { commits: 1200, repos: 18, stars: 400, months_active: 30 },
            verified_work_entries: 0,
          },
          items: [
            {
              id: 'truehire:sarthak:repo:sarthak/rolepatch',
              title: 'sarthak/rolepatch',
              claim: '250 commits',
              source: 'truehire',
              source_label: 'TrueHire public work',
              source_url: 'https://github.com/sarthak/rolepatch',
              readiness: 'Verified public work',
              tags: ['TypeScript'],
            },
          ],
        }),
      })
    );

    render(<TrueHireProofPreview />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('TrueHire handle'), '@sarthak');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.click(await screen.findByRole('button', { name: 'Import to evidence' }));

    expect(mockImportTrueHireProofEvidence).toHaveBeenCalledWith('sarthak');
    expect(await screen.findByText(/Imported 1 proof item from @sarthak/i)).toBeDefined();
  });

  it('imports previewed TrueHire proof locally for guests', async () => {
    mockUseAuth.mockReturnValue({ isGuest: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          profile: {
            handle: 'sarthak',
            profile_url: 'https://truehire.example/@sarthak',
            overall_score: 91,
            public_work: { commits: 1200, repos: 18, stars: 400, months_active: 30 },
            verified_work_entries: 0,
          },
          items: [
            {
              id: 'truehire:sarthak:repo:sarthak/rolepatch',
              title: 'sarthak/rolepatch',
              claim: '250 commits',
              source: 'truehire',
              source_label: 'TrueHire public work',
              source_url: 'https://github.com/sarthak/rolepatch',
              readiness: 'Verified public work',
              tags: ['TypeScript'],
            },
          ],
        }),
      })
    );

    render(<TrueHireProofPreview />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('TrueHire handle'), '@sarthak');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.click(await screen.findByRole('button', { name: 'Import to evidence' }));

    expect(mockLocalCreateAchievementEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '[TrueHire] sarthak/rolepatch',
        situation: expect.stringContaining('Imported from TrueHire profile @sarthak'),
        result: '250 commits',
      })
    );
    expect(await screen.findByText(/Imported 1 proof item locally/i)).toBeDefined();
  });

  it('shows API errors in the preview panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, error: 'TrueHire profile not found.' }),
      })
    );

    render(<TrueHireProofPreview />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('TrueHire handle'), '@missing');
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('TrueHire profile not found.')).toBeDefined();
  });
});
