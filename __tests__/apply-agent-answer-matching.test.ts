import { describe, expect, it } from 'vitest';

import {
  buildApplyAgentAnswerHints,
  matchApplyAgentAnswer,
  missingRequiredApplicationFields,
} from '@/lib/apply-agent-answer-matching';
import type { ProfileAnswer } from '@/lib/types';

function answer(
  input: Partial<ProfileAnswer> & Pick<ProfileAnswer, 'category' | 'label' | 'answer'>
) {
  return {
    id: input.id ?? input.label,
    sensitive: input.sensitive ?? 0,
    created_at: input.created_at ?? 1,
    updated_at: input.updated_at ?? 1,
    ...input,
  };
}

describe('apply-agent answer matching', () => {
  it('matches work authorization questions through category aliases', () => {
    const hints = buildApplyAgentAnswerHints([
      answer({
        category: 'work_authorization',
        label: 'Authorized to work?',
        answer: 'Yes',
      }),
    ]);

    expect(
      matchApplyAgentAnswer('Are you legally authorized to work in the United States?', hints)
    ).toBe('Yes');
  });

  it('matches sponsorship questions that use now-or-future phrasing', () => {
    const hints = buildApplyAgentAnswerHints([
      answer({
        category: 'sponsorship',
        label: 'Need sponsorship?',
        answer: 'No',
      }),
    ]);

    expect(
      matchApplyAgentAnswer('Will you now or in the future require immigration sponsorship?', hints)
    ).toBe('No');
  });

  it('matches links, location, and salary from common ATS labels', () => {
    const hints = buildApplyAgentAnswerHints([
      answer({ category: 'links', label: 'GitHub', answer: 'https://github.com/sarthak' }),
      answer({ category: 'location', label: 'Current city', answer: 'San Francisco, CA' }),
      answer({ category: 'salary', label: 'Target compensation', answer: '$180k base' }),
    ]);

    expect(matchApplyAgentAnswer('GitHub profile URL', hints)).toBe('https://github.com/sarthak');
    expect(matchApplyAgentAnswer('What city are you currently located in?', hints)).toBe(
      'San Francisco, CA'
    );
    expect(matchApplyAgentAnswer('Desired base salary', hints)).toBe('$180k base');
  });

  it('does not use unrelated safety preferences for arbitrary fields', () => {
    const hints = buildApplyAgentAnswerHints([
      answer({ category: 'other', label: 'Daily guarded submit cap', answer: '5' }),
    ]);

    expect(matchApplyAgentAnswer('Phone number', hints)).toBeNull();
  });

  it('returns only required fields that saved answers cannot fill', () => {
    const missing = missingRequiredApplicationFields({
      requiredFields: [
        'Are you legally authorized to work in the United States?',
        'Portfolio URL',
        'Phone number',
      ],
      answers: [
        answer({ category: 'work_authorization', label: 'Authorized to work?', answer: 'Yes' }),
        answer({ category: 'links', label: 'Portfolio', answer: 'https://sarthak.dev' }),
      ],
    });

    expect(missing).toEqual(['Phone number']);
  });

  it('treats required cover-letter fields as answerable when a cover letter exists', () => {
    const missing = missingRequiredApplicationFields({
      requiredFields: ['Why are you interested in this role?', 'Expected salary'],
      answers: [answer({ category: 'salary', label: 'Desired salary', answer: '$180k' })],
      hasCoverLetter: true,
    });

    expect(missing).toEqual([]);
  });
});
