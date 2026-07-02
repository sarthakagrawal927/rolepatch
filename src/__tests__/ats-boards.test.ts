import { describe, expect, it } from 'vitest';

import { buildGoogleQuery } from '@/components/job-search-tips';
import { ATS_BOARDS, ATS_BOARD_NAMES, detectAtsBoard, slugToCompanyName } from '@/lib/ats-boards';

describe('detectAtsBoard', () => {
  describe('Ashby', () => {
    it('extracts company from /<company>/<job-id> path', () => {
      const info = detectAtsBoard('https://jobs.ashbyhq.com/acme-corp/product-manager');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('ashby');
      expect(info!.boardName).toBe('Ashby');
      expect(info!.company).toBe('acme-corp');
    });

    it('extracts company from /a/<company>/<job-id> path', () => {
      const info = detectAtsBoard('https://jobs.ashbyhq.com/a/acme/product-manager-123');
      expect(info).not.toBeNull();
      expect(info!.company).toBe('acme');
    });
  });

  describe('Greenhouse', () => {
    it('extracts company from boards.greenhouse.io/<company>', () => {
      const info = detectAtsBoard('https://boards.greenhouse.io/acme/jobs/12345');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('greenhouse');
      expect(info!.company).toBe('acme');
    });

    it('extracts company from <company>.greenhouse.io subdomain', () => {
      const info = detectAtsBoard('https://acme.greenhouse.io/jobs/12345');
      expect(info).not.toBeNull();
      expect(info!.company).toBe('acme');
    });
  });

  describe('Lever', () => {
    it('extracts company from jobs.lever.co/<company>/<job-id>', () => {
      const info = detectAtsBoard('https://jobs.lever.co/acme/product-manager');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('lever');
      expect(info!.company).toBe('acme');
    });
  });

  describe('iCIMS', () => {
    it('extracts company from subdomain', () => {
      const info = detectAtsBoard('https://acme.icims.com/jobs/12345');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('icims');
      expect(info!.company).toBe('acme');
    });

    it('returns null company for generic careers.icims.com', () => {
      const info = detectAtsBoard('https://careers.icims.com/jobs/12345');
      expect(info).not.toBeNull();
      expect(info!.company).toBeNull();
    });
  });

  describe('Jobvite', () => {
    it('extracts company from jobs.jobvite.com/<company>/...', () => {
      const info = detectAtsBoard('https://jobs.jobvite.com/acme/job-description');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('jobvite');
      expect(info!.company).toBe('acme');
    });
  });

  describe('Workday', () => {
    it('extracts company skipping locale segment', () => {
      const info = detectAtsBoard('https://wd1.myworkdayjobs.com/en-US/acme/job/123');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('workday');
      expect(info!.company).toBe('acme');
    });

    it('extracts company when no locale segment', () => {
      const info = detectAtsBoard('https://wd1.myworkdayjobs.com/acme/job/123');
      expect(info).not.toBeNull();
      expect(info!.company).toBe('acme');
    });
  });

  describe('BambooHR', () => {
    it('extracts company from <company>.bamboohr.com', () => {
      const info = detectAtsBoard('https://acme.bamboohr.com/jobs/');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('bamboohr');
      expect(info!.company).toBe('acme');
    });

    it('extracts company from jobs.bamboohr.com/<company>', () => {
      const info = detectAtsBoard('https://jobs.bamboohr.com/acme/positions');
      expect(info).not.toBeNull();
      expect(info!.company).toBe('acme');
    });
  });

  describe('SmartRecruiters', () => {
    it('extracts company from jobs.smartrecruiters.com/<company>/...', () => {
      const info = detectAtsBoard('https://jobs.smartrecruiters.com/acme/12345');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('smartrecruiters');
      expect(info!.company).toBe('acme');
    });
  });

  describe('JazzHR', () => {
    it('extracts company from apply.jazz.co/<company>/...', () => {
      const info = detectAtsBoard('https://apply.jazz.co/acme/12345');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('jazz');
      expect(info!.company).toBe('acme');
    });
  });

  describe('Workable', () => {
    it('extracts company from <company>.workable.com', () => {
      const info = detectAtsBoard('https://acme.workable.com/jobs/123');
      expect(info).not.toBeNull();
      expect(info!.board).toBe('workable');
      expect(info!.company).toBe('acme');
    });

    it('extracts company from careers.workable.com/<company>', () => {
      const info = detectAtsBoard('https://careers.workable.com/acme/jobs/123');
      expect(info).not.toBeNull();
      expect(info!.company).toBe('acme');
    });
  });

  describe('non-ATS URLs', () => {
    it('returns null for LinkedIn', () => {
      expect(detectAtsBoard('https://www.linkedin.com/jobs/view/123')).toBeNull();
    });

    it('returns null for generic websites', () => {
      expect(detectAtsBoard('https://example.com/careers/123')).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      expect(detectAtsBoard('not-a-url')).toBeNull();
    });
  });

  describe('board lists', () => {
    it('ATS_BOARDS has all 10 boards', () => {
      expect(ATS_BOARDS).toHaveLength(10);
      expect(ATS_BOARDS).toContain('ashby');
      expect(ATS_BOARDS).toContain('greenhouse');
      expect(ATS_BOARDS).toContain('lever');
      expect(ATS_BOARDS).toContain('icims');
      expect(ATS_BOARDS).toContain('jobvite');
      expect(ATS_BOARDS).toContain('workday');
      expect(ATS_BOARDS).toContain('bamboohr');
      expect(ATS_BOARDS).toContain('smartrecruiters');
      expect(ATS_BOARDS).toContain('jazz');
      expect(ATS_BOARDS).toContain('workable');
    });

    it('ATS_BOARD_NAMES matches boards count', () => {
      expect(ATS_BOARD_NAMES).toHaveLength(10);
    });
  });
});

describe('slugToCompanyName', () => {
  it('converts hyphenated slug to title case', () => {
    expect(slugToCompanyName('acme-corp')).toBe('Acme Corp');
  });

  it('converts underscored slug to title case', () => {
    expect(slugToCompanyName('acme_corp')).toBe('Acme Corp');
  });

  it('handles single word', () => {
    expect(slugToCompanyName('acme')).toBe('Acme');
  });

  it('returns null for null input', () => {
    expect(slugToCompanyName(null)).toBeNull();
  });

  it('handles multi-word slugs', () => {
    expect(slugToCompanyName('acme-corp-international')).toBe('Acme Corp International');
  });
});

describe('buildGoogleQuery', () => {
  it('builds a query with a single board and keywords', () => {
    const url = buildGoogleQuery('product manager', new Set(['ashby']));
    expect(url).toContain('google.com/search');
    expect(url).toContain('site%3Ajobs.ashbyhq.com');
    // encodeURIComponent encodes spaces as %20
    expect(url).toContain('product%20manager');
  });

  it('joins multiple boards with OR', () => {
    const url = buildGoogleQuery('engineer', new Set(['ashby', 'greenhouse', 'lever']));
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toContain(
      'site:jobs.ashbyhq.com OR site:boards.greenhouse.io OR site:jobs.lever.co'
    );
    expect(decoded).toContain('engineer');
  });

  it('handles empty keywords (site-only query)', () => {
    const url = buildGoogleQuery('', new Set(['ashby']));
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toBe('site:jobs.ashbyhq.com');
  });

  it('handles boolean OR in keywords', () => {
    const url = buildGoogleQuery('("pm intern" OR "product intern")', new Set(['ashby']));
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toContain('site:jobs.ashbyhq.com');
    expect(decoded).toContain('("pm intern" OR "product intern")');
  });

  it('returns empty site expression when no boards selected', () => {
    const url = buildGoogleQuery('product manager', new Set());
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toBe('product manager');
  });

  it('encodes special characters properly', () => {
    const url = buildGoogleQuery('"staff engineer" & manager', new Set(['ashby']));
    // Should be a valid URL — no raw spaces or unencoded quotes
    expect(url).not.toMatch(/\s/);
    expect(url).toContain('%22');
  });
});
