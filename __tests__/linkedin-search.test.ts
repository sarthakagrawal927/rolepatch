import { describe, it, expect } from 'vitest';
import { linkedinSearchUrl, hiringManagerSearchUrl } from '@/lib/linkedin-search';

describe('linkedinSearchUrl', () => {
  it('uses "recruiter" as the default role', () => {
    const url = linkedinSearchUrl('Acme');
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(url.startsWith('https://www.google.com/search?q=')).toBe(true);
    expect(decoded).toBe('site:linkedin.com/in "recruiter" "Acme"');
  });

  it('uses a provided role verbatim', () => {
    const url = linkedinSearchUrl('Acme', 'talent partner');
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toBe('site:linkedin.com/in "talent partner" "Acme"');
  });

  it('falls back to "recruiter" when role is empty/whitespace', () => {
    const url = linkedinSearchUrl('Acme', '   ');
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toBe('site:linkedin.com/in "recruiter" "Acme"');
  });

  it('still produces a valid URL when company is empty', () => {
    const url = linkedinSearchUrl('');
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(url.startsWith('https://www.google.com/search?q=')).toBe(true);
    expect(decoded).toBe('site:linkedin.com/in "recruiter" ""');
  });

  it('percent-encodes special characters in the company name', () => {
    const url = linkedinSearchUrl('A & B / Co', 'recruiter');
    // Ampersand, slash, and spaces must all be encoded so the URL is safe.
    expect(url).not.toContain(' ');
    expect(url).not.toContain('&B');
    expect(url).toContain('%20');
    expect(url).toContain('%26');
    // Decoding round-trips to the original query.
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toBe('site:linkedin.com/in "recruiter" "A & B / Co"');
  });
});

describe('hiringManagerSearchUrl', () => {
  it('appends "hiring manager" to the role title', () => {
    const url = hiringManagerSearchUrl('Acme', 'Staff Engineer');
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toBe('site:linkedin.com/in "Staff Engineer hiring manager" "Acme"');
  });

  it('falls back to "hiring manager" when role title is blank', () => {
    const url = hiringManagerSearchUrl('Acme', '   ');
    const decoded = decodeURIComponent(url.split('?q=')[1]);
    expect(decoded).toBe('site:linkedin.com/in "hiring manager" "Acme"');
  });
});
