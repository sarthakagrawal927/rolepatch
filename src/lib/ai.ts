import { google } from '@ai-sdk/google';

const ALLOWED_MODELS = new Set([
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]);

export function getAIModel(modelOverride?: string) {
  const requested = modelOverride || process.env.AI_MODEL || 'gemini-2.5-pro';
  const model = ALLOWED_MODELS.has(requested) ? requested : 'gemini-2.5-pro';
  return google(model);
}
