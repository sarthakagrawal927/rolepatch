import { describe, expect, it } from 'vitest';

import {
  buildCampaignSummary,
  extractCampaignContact,
  type CampaignJobWithActivity,
} from '@/lib/application-campaign';

const now = 1_775_772_000;

function job(overrides: Partial<CampaignJobWithActivity>): CampaignJobWithActivity {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    company: overrides.company ?? 'Acme',
    role: overrides.role ?? 'Engineer',
    status: overrides.status ?? 'draft',
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? overrides.created_at ?? now,
    follow_up_at: overrides.follow_up_at ?? null,
    interview_date: overrides.interview_date ?? null,
    notes: overrides.notes ?? null,
  };
}

describe('application campaign summary', () => {
  it('tracks weekly application progress and funnel metrics', () => {
    const summary = buildCampaignSummary(
      [
        job({ status: 'applied', created_at: now }),
        job({ status: 'interview', created_at: now }),
        job({ status: 'rejected', created_at: now }),
      ],
      { now, weeklyTarget: 6 }
    );

    expect(summary.appliedThisWeek).toBe(3);
    expect(summary.weeklyProgressPct).toBe(50);
    expect(summary.responseRatePct).toBe(33);
  });

  it('surfaces follow-ups and stale drafts as next actions', () => {
    const summary = buildCampaignSummary(
      [
        job({ id: 'follow-up', status: 'applied', follow_up_at: now - 60 }),
        job({ id: 'stale', status: 'tailored', created_at: now - 9 * 24 * 60 * 60 }),
      ],
      { now }
    );

    expect(summary.followUpsDue).toBe(1);
    expect(summary.staleDrafts).toBe(1);
    expect(summary.nextActions.map((action) => action.jobId)).toEqual(['follow-up', 'stale']);
    expect(summary.nextActions.map((action) => action.timing)).toEqual([
      'Due today',
      '9d inactive',
    ]);
  });

  it('adds timing labels for overdue follow-ups and upcoming interviews', () => {
    const summary = buildCampaignSummary(
      [
        job({ id: 'overdue', status: 'applied', follow_up_at: now - 2 * 24 * 60 * 60 }),
        job({ id: 'interview', status: 'interview', interview_date: now + 2 * 24 * 60 * 60 }),
      ],
      { now }
    );

    expect(summary.nextActions.map((action) => [action.jobId, action.timing])).toEqual([
      ['overdue', '2d overdue'],
      ['interview', 'In 2d'],
    ]);
  });

  it('extracts recruiter contact context from notes for next actions', () => {
    const summary = buildCampaignSummary(
      [
        job({
          id: 'follow-up',
          status: 'applied',
          follow_up_at: now - 60,
          notes: 'Recruiter: Jane Patel\njane@acme.test',
        }),
      ],
      { now }
    );

    expect(summary.nextActions[0]).toMatchObject({
      jobId: 'follow-up',
      contact: 'jane@acme.test',
    });
    expect(decodeURIComponent(summary.nextActions[0].recruiterSearchUrl)).toContain(
      'site:linkedin.com/in "recruiter" "Acme"'
    );
    expect(decodeURIComponent(summary.nextActions[0].hiringManagerSearchUrl)).toContain(
      'site:linkedin.com/in "Engineer hiring manager" "Acme"'
    );
  });

  it('extracts contact hints from common note formats', () => {
    expect(extractCampaignContact('Recruiter: Jane Patel')).toBe('Jane Patel');
    expect(extractCampaignContact('Contact - https://linkedin.com/in/jane')).toBe(
      'https://linkedin.com/in/jane'
    );
    expect(extractCampaignContact('No contact yet')).toBeNull();
  });

  it('uses the latest activity timestamp for weekly and stale calculations', () => {
    const summary = buildCampaignSummary(
      [
        job({
          id: 'recently-applied',
          status: 'applied',
          created_at: now - 10 * 24 * 60 * 60,
          updated_at: now - 2 * 24 * 60 * 60,
        }),
        job({
          id: 'recently-edited-draft',
          status: 'draft',
          created_at: now - 10 * 24 * 60 * 60,
          updated_at: now - 2 * 24 * 60 * 60,
        }),
      ],
      { now }
    );

    expect(summary.appliedThisWeek).toBe(1);
    expect(summary.staleDrafts).toBe(0);
    expect(summary.nextActions.map((action) => action.jobId)).toEqual([]);
  });
});
