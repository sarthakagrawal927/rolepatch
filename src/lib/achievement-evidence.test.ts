import { describe, expect, it } from 'vitest';

import {
  buildProofItemsForJob,
  buildProofPacketPreview,
  extractEvidenceSourceUrl,
  formatEvidenceBullet,
  proofReadinessForEvidence,
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

  it('derives proof packet readiness without claiming external verification', () => {
    expect(proofReadinessForEvidence(evidence({ action: '', result: '' }))).toMatchObject({
      status: 'needs_claim',
      missing: expect.arrayContaining(['action', 'outcome']),
    });

    expect(
      proofReadinessForEvidence(evidence({ metric: '', scope: '', situation: '' }))
    ).toMatchObject({
      status: 'needs_support',
      missing: expect.arrayContaining(['metric', 'scope or context']),
    });

    expect(proofReadinessForEvidence(evidence({ skills: [], role_targets: [] }))).toMatchObject({
      status: 'packet_ready',
      label: 'Packet-ready',
    });

    expect(
      proofReadinessForEvidence(evidence({ skills: ['React'], role_targets: ['frontend'] }))
    ).toMatchObject({
      status: 'proof_ready',
      summary: expect.stringContaining('user-provided until external verification ships'),
    });
  });

  it('builds a proof packet preview from shareable evidence first', () => {
    const preview = buildProofPacketPreview([
      evidence({
        id: 'claim',
        title: 'Missing claim',
        action: '',
        result: '',
        updated_at: 3,
      }),
      evidence({
        id: 'packet',
        title: 'Packet item',
        skills: [],
        role_targets: [],
        updated_at: 2,
      }),
      evidence({
        id: 'ready',
        title: 'Ready item',
        situation: 'Imported from TrueHire. Source: https://github.com/acme/checkout',
        skills: ['React'],
        role_targets: ['frontend'],
        updated_at: 1,
      }),
    ]);

    expect(preview.shareable.map((item) => item.id)).toEqual(['ready', 'packet']);
    expect(preview.needsWork.map((item) => item.id)).toEqual(['claim']);
    expect(preview.shareable[0]).toMatchObject({
      title: 'Ready item',
      readiness: { status: 'proof_ready' },
      tags: ['React', 'frontend'],
      source_url: 'https://github.com/acme/checkout',
    });
  });

  it('extracts source URLs from evidence context', () => {
    expect(
      extractEvidenceSourceUrl(
        evidence({ situation: 'Imported from TrueHire. Source: https://github.com/acme/proof' })
      )
    ).toBe('https://github.com/acme/proof');
    expect(extractEvidenceSourceUrl(evidence({ scope: 'See https://example.com/work)' }))).toBe(
      'https://example.com/work'
    );
    expect(extractEvidenceSourceUrl(evidence({ situation: 'No source link' }))).toBeUndefined();
  });

  it('orders proof packet items by job relevance among shareable evidence', () => {
    const items = buildProofItemsForJob(
      [
        evidence({
          id: 'platform',
          title: 'Platform migration',
          skills: ['Kubernetes'],
          role_targets: ['platform'],
          updated_at: 100,
        }),
        evidence({
          id: 'checkout',
          title: 'Checkout latency',
          skills: ['performance'],
          role_targets: ['frontend'],
          updated_at: 1,
        }),
      ],
      'Frontend Engineer',
      'Own checkout performance and client-side latency.'
    );

    expect(items.map((item) => item.id)).toEqual(['checkout', 'platform']);
  });
});
