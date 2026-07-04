import { describe, expect, it } from 'vitest';

import { AIServiceError, toUserFacingAIError } from '@/lib/ai';

describe('AI error normalization', () => {
  it('preserves product-level token errors', () => {
    const error = new Error('No tokens remaining. Purchase more to continue.');

    expect(toUserFacingAIError(error)).toBe(error);
  });

  it('maps provider rate limits to retryable user copy', () => {
    const error = toUserFacingAIError(new Error('429 rate_limit_exceeded'));

    expect(error).toBeInstanceOf(AIServiceError);
    expect(error.message).toMatch(/busy right now/i);
    expect((error as AIServiceError).retryable).toBe(true);
  });

  it('maps provider auth failures to settings copy', () => {
    const error = toUserFacingAIError(new Error('401 unauthorized: invalid API key'));

    expect(error).toBeInstanceOf(AIServiceError);
    expect(error.message).toMatch(/provider settings/i);
    expect((error as AIServiceError).retryable).toBe(false);
  });

  it('maps malformed model output to retryable copy', () => {
    const error = toUserFacingAIError(new Error('NoObjectGeneratedError: type validation failed'));

    expect(error).toBeInstanceOf(AIServiceError);
    expect(error.message).toMatch(/unexpected response/i);
    expect((error as AIServiceError).retryable).toBe(true);
  });
});
