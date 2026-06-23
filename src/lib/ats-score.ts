export interface ATSResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  totalKeywords: number;
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'shall',
  'should',
  'would',
  'could',
  'may',
  'might',
  'can',
  'need',
  'must',
  'ought',
  'and',
  'or',
  'but',
  'nor',
  'not',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  'each',
  'every',
  'all',
  'any',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'than',
  'too',
  'very',
  'just',
  'also',
  'for',
  'from',
  'with',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'over',
  'out',
  'off',
  'up',
  'down',
  'in',
  'on',
  'at',
  'to',
  'of',
  'by',
  'as',
  'if',
  'that',
  'this',
  'these',
  'those',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'when',
  'where',
  'why',
  'its',
  'it',
  'we',
  'they',
  'you',
  'he',
  'she',
  'our',
  'your',
  'their',
  'his',
  'her',
  'my',
]);

const FILLER_WORDS = new Set([
  'experience',
  'team',
  'work',
  'company',
  'role',
  'position',
  'job',
  'ability',
  'skills',
  'requirements',
  'qualifications',
  'responsibilities',
  'opportunity',
  'looking',
  'seeking',
  'join',
  'ideal',
  'candidate',
  'required',
  'preferred',
  'plus',
  'strong',
  'excellent',
  'good',
  'working',
  'environment',
  'culture',
  'benefits',
  'salary',
  'apply',
  'include',
  'including',
  'etc',
  'well',
  'like',
  'new',
  'use',
  'using',
  'ensure',
  'help',
  'across',
  'within',
  'part',
  'best',
  'years',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, '')) // strip leading/trailing dots and dashes
    .filter((w) => w.length >= 3);
}

function isKeyword(word: string): boolean {
  return !STOP_WORDS.has(word) && !FILLER_WORDS.has(word);
}

function extractBigrams(words: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    if (isKeyword(words[i]) && isKeyword(words[i + 1])) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  return bigrams;
}

export function calculateATSScore(resumeText: string, jdText: string): ATSResult {
  if (!resumeText.trim() || !jdText.trim()) {
    return { score: 0, matchedKeywords: [], missingKeywords: [], totalKeywords: 0 };
  }

  const jdWords = tokenize(jdText);
  const resumeLower = resumeText.toLowerCase();

  // Count keyword frequency in JD
  const freq = new Map<string, number>();
  for (const word of jdWords) {
    if (isKeyword(word)) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }

  // Extract bigrams from JD
  const jdBigrams = extractBigrams(jdWords);
  const bigramFreq = new Map<string, number>();
  for (const bg of jdBigrams) {
    bigramFreq.set(bg, (bigramFreq.get(bg) ?? 0) + 1);
  }

  // Important = appears 2+ times (unigrams or bigrams)
  const important = new Set<string>();
  const regular = new Set<string>();

  for (const [word, count] of freq) {
    if (count >= 2) important.add(word);
    else regular.add(word);
  }
  for (const [bg, count] of bigramFreq) {
    if (count >= 2) important.add(bg);
    else regular.add(bg);
  }

  // If no important keywords, promote all regular to important
  if (important.size === 0) {
    for (const w of regular) important.add(w);
    regular.clear();
  }

  const allKeywords = new Set([...important, ...regular]);
  if (allKeywords.size === 0) {
    return { score: 0, matchedKeywords: [], missingKeywords: [], totalKeywords: 0 };
  }

  function matches(keyword: string): boolean {
    return resumeLower.includes(keyword);
  }

  const matchedImportant = [...important].filter(matches);
  const matchedRegular = [...regular].filter(matches);
  const matchedKeywords = [...matchedImportant, ...matchedRegular];
  const missingKeywords = [...allKeywords].filter((k) => !matches(k));

  // Score: important keywords worth 70%, regular worth 30%
  let score: number;
  if (regular.size === 0) {
    // All keywords are "important" (promoted) -- simple ratio
    score = (matchedImportant.length / important.size) * 100;
  } else {
    const importantScore = important.size > 0 ? (matchedImportant.length / important.size) * 70 : 0;
    const regularScore = regular.size > 0 ? (matchedRegular.length / regular.size) * 30 : 0;
    score = importantScore + regularScore;
  }

  return {
    score: Math.round(score),
    matchedKeywords,
    missingKeywords,
    totalKeywords: allKeywords.size,
  };
}
