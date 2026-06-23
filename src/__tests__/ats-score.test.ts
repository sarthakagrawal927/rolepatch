import { describe, expect, it } from 'vitest';

import { calculateATSScore } from '@/lib/ats-score';

describe('calculateATSScore', () => {
  it('returns 0 for empty inputs', () => {
    expect(calculateATSScore('', '')).toEqual({
      score: 0,
      matchedKeywords: [],
      missingKeywords: [],
      totalKeywords: 0,
    });
  });

  it('scores high for strong keyword overlap', () => {
    const jd = 'React TypeScript Node.js React TypeScript Node.js';
    const resume =
      'I work with React, TypeScript, and Node.js daily. React TypeScript Node.js are my core stack.';
    const result = calculateATSScore(resume, jd);
    // Unigrams match perfectly, bigrams may partially match
    expect(result.score).toBeGreaterThan(40);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('detects missing keywords', () => {
    const jd = 'Python machine learning TensorFlow Python machine learning TensorFlow';
    const resume = 'I build web apps with JavaScript and React.';
    const result = calculateATSScore(resume, jd);
    expect(result.score).toBeLessThan(20);
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });

  it('handles bigram matching', () => {
    const jd = 'machine learning machine learning deep learning deep learning';
    const resume = 'Experience with machine learning and deep learning pipelines.';
    const result = calculateATSScore(resume, jd);
    expect(result.matchedKeywords).toEqual(
      expect.arrayContaining([expect.stringContaining('machine learning')])
    );
  });

  it('filters stop words and filler words', () => {
    const jd = 'the company is looking for a strong candidate with good experience';
    const resume = 'the company is looking for a strong candidate with good experience';
    const result = calculateATSScore(resume, jd);
    // Most words are stop/filler, so totalKeywords should be very low
    expect(result.totalKeywords).toBeLessThan(5);
  });
});
