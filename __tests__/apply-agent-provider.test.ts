import { describe, expect, it } from 'vitest';

import { inferAtsProvider } from '@/lib/apply-agent';
import { isReviewedBrowserProvider } from '@/lib/apply-agent-browser-run';

describe('apply-agent provider support', () => {
  it.each([
    ['https://boards.greenhouse.io/acme/jobs/1', 'greenhouse'],
    ['https://jobs.lever.co/acme/1', 'lever'],
    ['https://jobs.ashbyhq.com/acme/1', 'ashby'],
    ['https://acme.myworkdayjobs.com/jobs/1', 'workday'],
    ['https://apply.workable.com/acme/j/frontend', 'workable'],
    ['https://acme.recruitee.com/o/customer-success', 'recruitee'],
    ['https://acme.jobs.personio.com/job/10', 'personio'],
  ])('infers %s as %s', (url, provider) => {
    expect(inferAtsProvider(url)).toBe(provider);
  });

  it('aligns reviewed browser support with extension-supported ATS providers', () => {
    expect(
      ['greenhouse', 'lever', 'workday', 'ashby', 'workable', 'recruitee', 'personio'].every(
        isReviewedBrowserProvider
      )
    ).toBe(true);
  });
});
