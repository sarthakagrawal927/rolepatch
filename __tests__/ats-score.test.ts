import { describe, expect, it } from 'vitest';

import { calculateATSScore } from '@/lib/ats-score';

describe('calculateATSScore', () => {
  it('returns 0 for empty inputs', () => {
    expect(calculateATSScore('', '').score).toBe(0);
    expect(calculateATSScore('some text', '').score).toBe(0);
    expect(calculateATSScore('', 'some text').score).toBe(0);
    expect(calculateATSScore('   ', '   ').score).toBe(0);
  });

  it('returns 100 for perfect match', () => {
    // Use simple, distinct keywords so all unigrams + bigrams are present in resume
    const jd = 'Python React TypeScript PostgreSQL';
    const resume = 'Experienced with Python React TypeScript PostgreSQL developer building APIs.';
    const result = calculateATSScore(resume, jd);
    expect(result.score).toBe(100);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it('excludes common stop words', () => {
    const jd =
      'the is are was were have has had do does did will shall should would could may might can need must';
    const resume = 'completely different content here nothing matches at all';
    const result = calculateATSScore(resume, jd);
    // All JD words are stop words, so no keywords extracted
    expect(result.totalKeywords).toBe(0);
    expect(result.score).toBe(0);
  });

  it('excludes filler words', () => {
    const jd =
      'experience team work company role position job ability skills requirements qualifications';
    const resume = 'something completely unrelated';
    const result = calculateATSScore(resume, jd);
    expect(result.totalKeywords).toBe(0);
  });

  it('scores partial matches correctly', () => {
    const jd =
      'Looking for Python developer. Python experience required. Must know React and Node.js.';
    const resume = 'Python developer with 5 years experience.';
    const result = calculateATSScore(resume, jd);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.matchedKeywords).toContain('python');
    expect(result.matchedKeywords).toContain('developer');
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });

  it('handles bigram extraction', () => {
    const jd =
      'Must have machine learning experience. Machine learning is required. Also need data analysis and project management.';
    const resume =
      'Expert in machine learning, deep learning, and data analysis. Led project management initiatives.';
    const result = calculateATSScore(resume, jd);
    expect(result.matchedKeywords).toContain('machine learning');
    expect(result.score).toBeGreaterThan(50);
  });

  it('is case insensitive', () => {
    const jd = 'Requires PYTHON and JavaScript. Python is essential.';
    const resume = 'Skilled in python and javascript development.';
    const result = calculateATSScore(resume, jd);
    expect(result.matchedKeywords).toContain('python');
    expect(result.matchedKeywords).toContain('javascript');
  });

  it('gives higher weight to important (repeated) keywords', () => {
    // "python" appears 3 times -> important, "rust" appears once -> regular
    const jd = 'Python Python Python developer needed. Rust is a bonus.';
    const resumeWithPython = 'Python developer with 5 years experience.';
    const resumeWithRust = 'Rust developer with 5 years experience.';

    const scorePython = calculateATSScore(resumeWithPython, jd);
    const scoreRust = calculateATSScore(resumeWithRust, jd);

    // Matching the important keyword (python) should give a higher score
    expect(scorePython.score).toBeGreaterThan(scoreRust.score);
  });

  it('returns matched and missing keyword lists', () => {
    const jd =
      'Need React TypeScript Node.js PostgreSQL Redis experience. React and TypeScript are critical.';
    const resume =
      'Built applications with React and TypeScript. Used PostgreSQL for data storage.';
    const result = calculateATSScore(resume, jd);

    expect(result.matchedKeywords).toContain('react');
    expect(result.matchedKeywords).toContain('typescript');
    expect(result.matchedKeywords).toContain('postgresql');
    expect(result.missingKeywords).toContain('redis');
    expect(result.totalKeywords).toBeGreaterThan(0);
    expect(result.matchedKeywords.length + result.missingKeywords.length).toBe(
      result.totalKeywords
    );
  });
});
