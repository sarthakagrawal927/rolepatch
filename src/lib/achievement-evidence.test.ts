import { describe, expect, it } from 'vitest';

import {
  formatEvidenceBullet,
  rankEvidenceForRole,
  scoreEvidenceQuality,
  splitEvidenceList,
} from '@/lib/achievement-evidence';
import type { AchievementEvidence } from '@/lib/types';

function evidence(overrides: Partial<AchievementEvidence>): AchievementEvidence {
  return {
    id: 'ev-1',
    title: 'Default',
    situation: '',
    action: 'Led migration',
    result: 'reduced build time',
    metric: '42%',
    scope: '12 repos',
    skills: [],
    role_targets: [],
    impact_type: 'technical',
    created_at: 1,
    updated_at: 1,
    ...overrides,
  };
}

describe('achievement evidence helpers', () => {
  it('splits comma separated skills and removes blanks', () => {
    expect(splitEvidenceList('React, systems, , analytics')).toEqual([
      'React',
      'systems',
      'analytics',
    ]);
  });

  it('formats quantified bullets from reusable proof fields', () => {
    expect(formatEvidenceBullet(evidence({}))).toBe(
      'Led migration, reduced build time (42% across 12 repos)'
    );
  });

  it('ranks role-targeted and skill-matched evidence first', () => {
    const entries = [
      evidence({ id: 'old', title: 'Old', role_targets: [], skills: [], updated_at: 10 }),
      evidence({
        id: 'frontend',
        title: 'Frontend',
        role_targets: ['frontend'],
        skills: ['React'],
        updated_at: 1,
      }),
      evidence({
        id: 'systems',
        title: 'Systems',
        role_targets: ['platform'],
        skills: ['distributed systems'],
        updated_at: 2,
      }),
    ];

    expect(rankEvidenceForRole(entries, 'Senior Frontend React Engineer')[0]?.id).toBe('frontend');
  });

  it('flags weak evidence missing metrics or outcomes', () => {
    expect(scoreEvidenceQuality(evidence({ metric: '', result: '', action: '' }))).toBe('weak');
    expect(
      scoreEvidenceQuality(
        evidence({
          metric: '42%',
          result: 'faster builds',
          action: 'Led migration',
          scope: '',
          situation: '',
        })
      )
    ).toBe('usable');
    expect(
      scoreEvidenceQuality(
        evidence({
          metric: '42%',
          result: 'faster builds',
          action: 'Led migration',
          scope: '12 repos',
          situation: 'Legacy CI',
        })
      )
    ).toBe('strong');
  });
});
