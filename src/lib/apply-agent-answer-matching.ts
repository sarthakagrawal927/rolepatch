import type { ProfileAnswer, ProfileAnswerCategory } from '@/lib/types';

export interface ApplyAgentAnswerHint {
  category: ProfileAnswerCategory;
  label: string;
  answer: string;
  aliases: string[];
}

type MatchableProfileAnswer = Pick<ProfileAnswer, 'category' | 'label' | 'answer'>;

const CATEGORY_ALIASES: Record<ProfileAnswerCategory, string[]> = {
  identity: [
    'full name',
    'legal name',
    'preferred name',
    'first name',
    'last name',
    'email',
    'phone',
  ],
  work_authorization: [
    'authorized to work',
    'legally authorized',
    'eligible to work',
    'right to work',
    'work authorization',
    'employment authorization',
    'can you work',
  ],
  sponsorship: [
    'visa sponsorship',
    'require sponsorship',
    'need sponsorship',
    'future sponsorship',
    'now or in the future',
    'h1b',
    'h-1b',
    'immigration sponsorship',
  ],
  location: [
    'current location',
    'city',
    'state',
    'country',
    'address',
    'remote',
    'relocate',
    'willing to relocate',
  ],
  salary: [
    'salary',
    'expected salary',
    'desired salary',
    'compensation',
    'base salary',
    'pay range',
  ],
  links: ['linkedin', 'github', 'portfolio', 'website', 'personal site', 'profile url', 'url'],
  open_ended: [
    'why are you interested',
    'why this role',
    'why do you want',
    'cover letter',
    'additional information',
    'anything else',
    'message to hiring',
  ],
  other: [],
};

const STOPWORDS = new Set([
  'and',
  'are',
  'can',
  'did',
  'does',
  'for',
  'have',
  'into',
  'now',
  'our',
  'the',
  'this',
  'will',
  'with',
  'you',
  'your',
]);

export function normalizeApplicationQuestion(value: string): string {
  return value
    .toLowerCase()
    .replace(/h[\s-]?1b/g, 'h1b')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function terms(value: string): string[] {
  return normalizeApplicationQuestion(value)
    .split(' ')
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

function aliasVariants(answer: MatchableProfileAnswer): string[] {
  const label = normalizeApplicationQuestion(answer.label);
  const aliases = CATEGORY_ALIASES[answer.category] ?? [];
  return [...new Set([label, ...aliases.map(normalizeApplicationQuestion)].filter(Boolean))];
}

export function buildApplyAgentAnswerHints(
  answers: MatchableProfileAnswer[]
): ApplyAgentAnswerHint[] {
  return answers
    .filter((answer) => answer.label.trim() && answer.answer.trim())
    .map((answer) => ({
      category: answer.category,
      label: answer.label,
      answer: answer.answer,
      aliases: aliasVariants(answer),
    }));
}

export function matchApplyAgentAnswer(
  questionLabel: string,
  hints: ApplyAgentAnswerHint[]
): string | null {
  const target = normalizeApplicationQuestion(questionLabel);
  if (!target) return null;

  let best: { answer: string; score: number } | null = null;
  for (const hint of hints) {
    const aliases = hint.aliases.length ? hint.aliases : [normalizeApplicationQuestion(hint.label)];
    let score = 0;
    for (const alias of aliases) {
      if (!alias) continue;
      if (target === alias) score = Math.max(score, 14);
      if (target.includes(alias) || alias.includes(target)) score = Math.max(score, 10);
      const aliasTerms = terms(alias);
      if (aliasTerms.length > 0) {
        const overlap = aliasTerms.filter((term) => target.includes(term)).length;
        score = Math.max(score, overlap);
      }
    }
    if (hint.category !== 'other') {
      const categoryOverlap = CATEGORY_ALIASES[hint.category].some((alias) =>
        target.includes(normalizeApplicationQuestion(alias))
      );
      if (categoryOverlap) score = Math.max(score, 8);
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { answer: hint.answer, score };
    }
  }

  return best && best.score >= 2 ? best.answer : null;
}
