import { describe, expect, it } from 'vitest';

import { canonicalJobUrl, jobUrlVariants } from '@/lib/job-url';

describe('job URL normalization', () => {
  it('strips query strings, hashes, and trailing slashes while preserving the URL path', () => {
    expect(canonicalJobUrl('https://Boards.Greenhouse.io/acme/jobs/123/?gh_src=abc#app')).toBe(
      'https://boards.greenhouse.io/acme/jobs/123'
    );
  });

  it('keeps the exact URL as a lookup variant before the canonical URL', () => {
    expect(jobUrlVariants('https://jobs.lever.co/acme/1?source=linkedin#apply')).toEqual([
      'https://jobs.lever.co/acme/1?source=linkedin#apply',
      'https://jobs.lever.co/acme/1',
    ]);
  });
});
