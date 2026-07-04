import { describe, expect, it } from 'vitest';

import { buildDiscoveryEngagementSummary } from '@/lib/job-discovery-alerts';

describe('discovery engagement summary', () => {
  it('summarizes saved searches, company watches, alerts, and fallback health', () => {
    const summary = buildDiscoveryEngagementSummary({
      savedSearches: [{ paused: false }, { paused: true }, { paused: 0 }],
      companyWatches: [
        { paused: false, last_source: 'greenhouse', last_found_count: 4, last_error: null },
        { paused: 1, last_source: 'linkedin_fallback', last_found_count: 2, last_error: 'timeout' },
      ],
      shortlist: [{ id: 'saved-1' }],
      alerts: [
        { seen: false, source: 'greenhouse' },
        { seen: 0, source: 'greenhouse' },
        { seen: true, source: 'linkedin' },
      ],
    });

    expect(summary.savedSearches).toBe(3);
    expect(summary.activeSavedSearches).toBe(2);
    expect(summary.companyWatches).toBe(2);
    expect(summary.activeCompanyWatches).toBe(1);
    expect(summary.shortlist).toBe(1);
    expect(summary.alerts).toBe(3);
    expect(summary.unseenAlerts).toBe(2);
    expect(summary.watchedRolesFound).toBe(6);
    expect(summary.watchesWithFallback).toBe(1);
    expect(summary.latestSource).toBe('greenhouse');
    expect(summary.sourceDecision.status).toBe('needs_attention');
    expect(summary.sourceDecision.label).toBe('Fix fallback sources');
    expect(summary.sources).toEqual([
      { source: 'greenhouse', count: 3 },
      { source: 'linkedin', count: 1 },
      { source: 'linkedin_fallback', count: 1 },
    ]);
  });

  it('returns zeroed metrics when discovery has not run yet', () => {
    const summary = buildDiscoveryEngagementSummary({
      savedSearches: [],
      companyWatches: [],
      shortlist: [],
      alerts: [],
    });

    expect(summary).toMatchObject({
      savedSearches: 0,
      activeSavedSearches: 0,
      companyWatches: 0,
      activeCompanyWatches: 0,
      shortlist: 0,
      alerts: 0,
      unseenAlerts: 0,
      watchedRolesFound: 0,
      watchesWithFallback: 0,
      latestSource: null,
    });
    expect(summary.sourceDecision).toMatchObject({
      status: 'setup',
      label: 'Set up discovery',
    });
    expect(summary.sources).toEqual([]);
  });

  it('recommends collecting more runs when configured discovery has no signal yet', () => {
    const summary = buildDiscoveryEngagementSummary({
      savedSearches: [{ paused: false }],
      companyWatches: [{ paused: false, last_source: null, last_found_count: 0, last_error: null }],
      shortlist: [],
      alerts: [],
    });

    expect(summary.sourceDecision).toMatchObject({
      status: 'collecting',
      label: 'Collect more runs',
    });
  });

  it('recommends tuning current sources when discovery is producing signal', () => {
    const summary = buildDiscoveryEngagementSummary({
      savedSearches: [{ paused: false }],
      companyWatches: [{ paused: false, last_source: 'greenhouse', last_found_count: 3 }],
      shortlist: [],
      alerts: [{ seen: true, source: 'greenhouse' }],
    });

    expect(summary.sourceDecision.status).toBe('healthy');
    expect(summary.sourceDecision.detail).toContain('greenhouse');
  });
});
