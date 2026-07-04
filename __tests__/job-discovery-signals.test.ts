import { describe, expect, it } from 'vitest';

import { inferJobSignals } from '@/lib/job-discovery-alerts';

describe('inferJobSignals', () => {
  it('extracts scan-friendly role signals from job text', () => {
    expect(
      inferJobSignals({
        id: 'job-1',
        title: 'Senior AI Engineer',
        company: 'Acme',
        location: 'Remote',
        is_remote: true,
        description_short: 'H-1B visa sponsorship available for experienced candidates.',
      })
    ).toEqual([
      { id: 'remote', label: 'Remote' },
      { id: 'visa', label: 'Visa signal' },
      { id: 'senior', label: 'Senior' },
    ]);
  });

  it('detects new-grad and contract signals without a remote flag', () => {
    expect(
      inferJobSignals({
        id: 'job-2',
        title: 'New Graduate Software Engineer',
        company: 'Beta',
        location: 'New York',
        job_type: 'Contract',
        description_short: 'Entry-level contract program for university grads.',
      })
    ).toEqual([
      { id: 'new_grad', label: 'New grad' },
      { id: 'contract', label: 'Contract' },
    ]);
  });
});
