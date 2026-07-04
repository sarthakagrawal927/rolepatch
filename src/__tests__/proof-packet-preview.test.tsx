import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProofPacketPreview } from '@/components/proof-packet-preview';
import type { AchievementEvidence } from '@/lib/types';

const mockUseAuth = vi.fn(() => ({ isGuest: false }));
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockLocalListAchievementEvidence = vi.fn<() => AchievementEvidence[]>(() => []);
vi.mock('@/lib/local-storage', () => ({
  localListAchievementEvidence: () => mockLocalListAchievementEvidence(),
}));

function evidence(overrides: Partial<AchievementEvidence>): AchievementEvidence {
  return {
    id: 'ev-1',
    title: 'Checkout speedup',
    situation: 'Slow checkout',
    action: 'Led checkout performance work',
    result: 'reduced checkout latency',
    metric: '42%',
    scope: '3 markets',
    skills: ['performance'],
    role_targets: ['frontend'],
    impact_type: 'speed',
    created_at: 1,
    updated_at: 1,
    ...overrides,
  };
}

describe('ProofPacketPreview', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isGuest: false });
    mockLocalListAchievementEvidence.mockReset();
    mockLocalListAchievementEvidence.mockReturnValue([]);
  });

  it('renders shareable and cleanup proof packet sections from server evidence', () => {
    render(
      <ProofPacketPreview
        serverEntries={[
          evidence({
            id: 'ready',
            title: 'Checkout speedup',
            situation: 'Slow checkout. Source: https://github.com/acme/checkout',
          }),
          evidence({ id: 'cleanup', title: 'Loose claim', metric: '', scope: '', situation: '' }),
        ]}
      />
    );

    expect(screen.getByText('Your proof packet')).toBeDefined();
    expect(screen.getByText('Ready for packet review')).toBeDefined();
    expect(screen.getByText('Needs proof cleanup')).toBeDefined();
    expect(screen.getByText('Checkout speedup')).toBeDefined();
    expect(screen.getByText('Loose claim')).toBeDefined();
    expect(screen.getAllByText('User-provided')).toHaveLength(2);
    expect(screen.getByText(/Missing: metric, scope or context/i)).toBeDefined();
    expect(screen.getByRole('link', { name: 'View source' })).toHaveAttribute(
      'href',
      'https://github.com/acme/checkout'
    );
  });

  it('copies a manual proof profile summary with source links', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <ProofPacketPreview
        serverEntries={[
          evidence({
            id: 'ready',
            title: 'Checkout speedup',
            situation: 'Slow checkout. Source: https://github.com/acme/checkout',
          }),
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Copy proof profile' }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('RolePatch proof profile'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Nothing is shared automatically')
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Source: https://github.com/acme/checkout')
    );
    expect(screen.getByRole('button', { name: 'Copied proof' })).toBeDefined();
  });

  it('uses guest local evidence when the user is in guest mode', () => {
    mockUseAuth.mockReturnValue({ isGuest: true });
    mockLocalListAchievementEvidence.mockReturnValueOnce([
      evidence({ id: 'guest', title: 'Guest proof item' }),
    ]);

    render(<ProofPacketPreview serverEntries={[]} />);

    expect(screen.getByText('Guest proof item')).toBeDefined();
    expect(mockLocalListAchievementEvidence).toHaveBeenCalled();
  });

  it('shows an empty state when no evidence exists', () => {
    render(<ProofPacketPreview serverEntries={[]} />);

    expect(screen.getByText('No proof evidence yet')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Add evidence' })).toHaveAttribute('href', '/evidence');
  });
});
