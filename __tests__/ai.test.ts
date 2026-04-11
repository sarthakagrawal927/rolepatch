import { describe, it, expect, vi } from 'vitest';

const { mockCreateOpenAICompatible, mockChatModel } = vi.hoisted(() => {
  const mockChatModel = vi.fn((model: string) => ({ modelId: model }));
  return {
    mockChatModel,
    mockCreateOpenAICompatible: vi.fn(() => ({ chatModel: mockChatModel })),
  };
});

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: mockCreateOpenAICompatible,
}));

import { getAIModel } from '@/lib/ai';

describe('getAIModel', () => {
  it('creates provider with the given config and returns a chat model', () => {
    const config = {
      endpointUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test-123',
      model: 'gpt-4o',
    };
    const result = getAIModel(config);

    expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
      baseURL: 'https://api.example.com/v1',
      apiKey: 'sk-test-123',
      name: 'custom',
    });
    expect(mockChatModel).toHaveBeenCalledWith('gpt-4o');
    expect(result).toEqual({ modelId: 'gpt-4o' });
  });

  it('passes empty strings when config fields are empty', () => {
    const config = { endpointUrl: '', apiKey: '', model: '' };
    getAIModel(config);

    expect(mockCreateOpenAICompatible).toHaveBeenCalledWith({
      baseURL: '',
      apiKey: '',
      name: 'custom',
    });
    expect(mockChatModel).toHaveBeenCalledWith('');
  });
});
