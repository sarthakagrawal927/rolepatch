// Wrapper that prefers Cloudflare Workers AI binding (free 10k Neurons/day)
// and falls back to the user-configured external OpenAI-compatible endpoint.
export { getAIModel } from './ai-cloudflare';

/**
 * A user-facing, retryable error.
 *
 * AI-provider failures (downtime, rate limits, malformed output) must never
 * surface as a raw stack trace or a silent blank. Server actions throw an
 * `AIServiceError` so the UI can show friendly, retryable copy.
 */
export class AIServiceError extends Error {
  /** True when retrying the same request has a reasonable chance of succeeding. */
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'AIServiceError';
    this.retryable = retryable;
  }
}

function looksLike(error: unknown, ...needles: string[]): boolean {
  const haystack = (
    (error instanceof Error ? `${error.name} ${error.message}` : String(error)) +
    ' ' +
    ((error as { code?: unknown })?.code ?? '')
  ).toLowerCase();
  return needles.some((n) => haystack.includes(n));
}

/**
 * Normalizes any thrown value from an AI SDK call into a user-facing
 * `AIServiceError`. Token / auth errors are passed through unchanged so the
 * UI's existing "No tokens remaining" handling keeps working.
 */
export function toUserFacingAIError(error: unknown): Error {
  // Preserve already-classified or product-level errors (tokens, auth).
  if (error instanceof AIServiceError) return error;
  if (
    error instanceof Error &&
    (error.message.includes('No tokens remaining') ||
      error.message.includes('insufficient_tokens') ||
      error.message.includes('Authentication required'))
  ) {
    return error;
  }

  if (looksLike(error, 'rate limit', 'rate_limit', '429', 'too many requests')) {
    return new AIServiceError(
      'The AI service is busy right now. Please wait a moment and try again.',
      true
    );
  }
  if (looksLike(error, 'timeout', 'timed out', 'aborted', 'etimedout')) {
    return new AIServiceError('The AI request took too long. Please try again.', true);
  }
  if (looksLike(error, 'api key', 'unauthorized', '401', '403', 'load api key', 'loadapikey')) {
    return new AIServiceError(
      'The AI provider rejected the request. Check your provider settings, then try again.',
      false
    );
  }
  if (
    looksLike(
      error,
      'no object generated',
      'noobjectgenerated',
      'json parse',
      'jsonparse',
      'type validation',
      'typevalidation',
      'invalid response'
    )
  ) {
    return new AIServiceError(
      'The AI returned an unexpected response. This usually clears up on a retry.',
      true
    );
  }

  return new AIServiceError("Couldn't reach the AI service. Please try again in a moment.", true);
}
