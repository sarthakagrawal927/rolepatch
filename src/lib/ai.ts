import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AIProviderConfig } from '@/lib/types';

export function getAIModel(config: AIProviderConfig) {
  const provider = createOpenAICompatible({
    baseURL: config.endpointUrl,
    apiKey: config.apiKey,
    name: 'custom',
  });
  return provider.chatModel(config.model);
}
