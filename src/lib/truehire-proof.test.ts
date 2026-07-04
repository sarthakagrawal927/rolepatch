import { describe, expect, it } from 'vitest';

import {
  mapTrueHirePublicExportToProof,
  normalizeTrueHireHandle,
  trueHireDataUrl,
  trueHireEvidenceDedupeKey,
  trueHireProofItemToEvidenceInput,
} from '@/lib/truehire-proof';

describe('truehire proof mapping', () => {
  it('normalizes handles and rejects non-TrueHire URLs', () => {
    expect(normalizeTrueHireHandle('@sarthak')).toBe('sarthak');
    expect(normalizeTrueHireHandle('https://truehire.sarthakagrawal927.workers.dev/@sarthak')).toBe(
      'sarthak'
    );
    expect(normalizeTrueHireHandle('https://example.com/@sarthak')).toBeNull();
    expect(normalizeTrueHireHandle('../secrets')).toBeNull();
  });

  it('builds a stable public data URL', () => {
    expect(trueHireDataUrl('sarthak', 'https://truehire.example')).toBe(
      'https://truehire.example/@sarthak/data.json'
    );
  });

  it('maps public work and confirmed employment into proof candidates', () => {
    const preview = mapTrueHirePublicExportToProof(
      {
        handle: 'sarthak',
        lastScoredAt: 1234,
        score: {
          overall: 88,
          signal1: 84,
          signal2: 20,
          totalCommits: 12345,
          totalRepos: 42,
          totalStars: 900,
          monthsActive: 38,
          evidenceJson: JSON.stringify([
            {
              repoFullName: 'sarthak/rolepatch',
              commits: 430,
              mergedPrs: 12,
              stars: 88,
              primaryLanguage: 'TypeScript',
              weight: 100,
              craftTags: ['CI', 'tests'],
            },
          ]),
        },
        workHistory: [
          {
            company: 'Acme',
            title: 'Staff Engineer',
            startDate: '2024-01',
            endDate: null,
            status: 'confirmed',
          },
          {
            company: 'Beta',
            title: 'Engineer',
            startDate: '2022-01',
            endDate: '2023-01',
            status: 'pending',
          },
        ],
      },
      'https://truehire.example'
    );

    expect(preview.profile).toMatchObject({
      handle: 'sarthak',
      overall_score: 88,
      signal1_score: 84,
      signal2_score: 20,
      verified_work_entries: 1,
      public_work: {
        commits: 12345,
        repos: 42,
        stars: 900,
        months_active: 38,
      },
    });
    expect(preview.items).toEqual([
      expect.objectContaining({
        title: 'Staff Engineer at Acme',
        readiness: 'Employer verified',
      }),
      expect.objectContaining({
        title: 'sarthak/rolepatch',
        claim: '430 commits · 12 merged PRs · 88 stars',
        readiness: 'Verified public work',
        tags: ['TypeScript', 'CI', 'tests'],
      }),
    ]);
  });

  it('converts proof items into private RolePatch evidence input', () => {
    const input = trueHireProofItemToEvidenceInput(
      {
        id: 'truehire:sarthak:repo:sarthak/rolepatch',
        title: 'sarthak/rolepatch',
        claim: '430 commits · 12 merged PRs · 88 stars',
        source: 'truehire',
        source_label: 'TrueHire public work',
        source_url: 'https://github.com/sarthak/rolepatch',
        readiness: 'Verified public work',
        tags: ['TypeScript', 'tests'],
      },
      {
        handle: 'sarthak',
        profile_url: 'https://truehire.example/@sarthak',
        overall_score: 88,
        signal1_score: 84,
        signal2_score: 20,
        last_verified_at: 123,
        public_work: {
          commits: 12345,
          repos: 42,
          stars: 900,
          months_active: 38,
        },
        verified_work_entries: 1,
      }
    );

    expect(input).toMatchObject({
      title: '[TrueHire] sarthak/rolepatch',
      situation:
        'Imported from TrueHire profile @sarthak. Source: https://github.com/sarthak/rolepatch',
      action: 'TrueHire public work',
      result: '430 commits · 12 merged PRs · 88 stars',
      scope: 'Verified public work; TrueHire score 88',
      skills: ['TypeScript', 'tests', 'TrueHire'],
      role_targets: ['verified public work'],
      impact_type: 'technical',
    });
    expect(trueHireEvidenceDedupeKey(input)).toContain('[TrueHire] sarthak/rolepatch');
  });
});
