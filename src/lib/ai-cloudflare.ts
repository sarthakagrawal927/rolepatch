import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

import type { AIProviderConfig } from './types';

/**
 * Build a LanguageModel from a provider config, talking to any
 * OpenAI-compatible endpoint (formerly @saas-maker/ai's createAIModel).
 */
function createAIModel(
  config: AIProviderConfig,
  options?: { headers?: Record<string, string>; name?: string }
): LanguageModel {
  const provider = createOpenAICompatible({
    baseURL: config.endpointUrl.trim().replace(/\/+$/, ''),
    apiKey: config.apiKey,
    name: options?.name ?? 'free-ai',
    headers: options?.headers,
  });
  return provider.chatModel(config.model);
}

/**
 * Default model for resume-tailor flows. Routed through free-ai-gateway,
 * which is the single Workers AI chokepoint for the Fleet and enforces a
 * daily 9500-Neuron hard cap (10k free quota minus 500 buffer).
 */
const DEFAULT_GATEWAY_MODEL = 'auto';

const FALLBACK_GATEWAY_BASE_URL = 'https://free-ai-gateway.sarthakagrawal927.workers.dev/v1';
const PROJECT_ID = 'resume-tailor';

function getGatewayBaseUrl(): string {
  const fromEnv = process.env.AI_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return FALLBACK_GATEWAY_BASE_URL;
}

function getGatewayApiKey(): string {
  return (process.env.AI_GATEWAY_API_KEY ?? process.env.AI_API_KEY)?.trim() ?? '';
}

/**
 * Returns a LanguageModel that talks to free-ai-gateway by default.
 *
 * Selection order:
 *   1. User-supplied endpointUrl + apiKey  → external provider (BYO key)
 *   2. Otherwise                           → free-ai-gateway (Fleet chokepoint)
 */
export function getAIModel(aiConfig: AIProviderConfig): LanguageModel {
  // Honour explicit user config first — lets users plug in their own keys
  // through the Settings UI.
  if (aiConfig.endpointUrl && aiConfig.apiKey) {
    return createAIModel(aiConfig);
  }

  const resolvedModel = aiConfig.model || DEFAULT_GATEWAY_MODEL;

  return createAIModel(
    {
      endpointUrl: getGatewayBaseUrl(),
      // free-ai-gateway tolerates an empty key, but createOpenAICompatible
      // requires a string — pass a placeholder so the Bearer header attaches.
      apiKey: getGatewayApiKey() || 'free-ai-gateway',
      model: resolvedModel,
    },
    {
      headers: {
        'x-gateway-project-id': PROJECT_ID,
      },
    }
  );
}
