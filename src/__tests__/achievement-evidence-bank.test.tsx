import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AchievementEvidenceBank } from '@/components/achievement-evidence-bank';
import type { AchievementEvidence } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ isGuest: false }),
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

describe('AchievementEvidenceBank proof readiness', () => {
  it('summarizes proof readiness from existing evidence records', () => {
    render(
      <AchievementEvidenceBank
        serverEntries={[
          evidence({ id: 'ready' }),
          evidence({ id: 'support', title: 'Loose claim', metric: '', scope: '', situation: '' }),
          evidence({ id: 'claim', title: 'Missing outcome', action: '', result: '' }),
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Proof readiness' })).toBeDefined();
    expect(screen.getAllByText(/user-provided until external verification ships/i).length).toBe(2);
    expect(screen.getAllByText('Proof-ready')).toHaveLength(2);
    expect(screen.getAllByText('Needs support')).toHaveLength(2);
    expect(screen.getAllByText('Needs claim')).toHaveLength(2);
    expect(screen.getByText(/Missing: metric, scope or context/i)).toBeDefined();
  });

  it('hides the readiness summary in compact dashboard mode', () => {
    render(<AchievementEvidenceBank compact serverEntries={[evidence({})]} />);

    expect(screen.queryByRole('heading', { name: 'Proof readiness' })).toBeNull();
    expect(screen.getByText('Proof-ready')).toBeDefined();
  });
});
