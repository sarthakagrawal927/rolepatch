import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchModels = vi.fn();
vi.mock('@/lib/ai-vendor', () => ({
  fetchModels: (...args: unknown[]) => mockFetchModels(...args),
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/ai/models', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function makeRawReq(body: string) {
  return new Request('https://rolepatch.com/api/ai/models', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  mockFetchModels.mockReset();
  vi.resetModules();
});

describe('POST /api/ai/models', () => {
  it('rejects invalid JSON before model discovery', async () => {
    const { POST } = await import('@/app/api/ai/models/route');
    const res = await POST(makeRawReq('{not-json'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
    expect(mockFetchModels).not.toHaveBeenCalled();
  });

  it('rejects non-object request bodies before model discovery', async () => {
    const { POST } = await import('@/app/api/ai/models/route');
    const res = await POST(makeReq(null));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Request body must be an object' });
    expect(mockFetchModels).not.toHaveBeenCalled();
  });

  it('fetches models with trimmed endpoint and API key', async () => {
    mockFetchModels.mockResolvedValue(['gpt-test']);

    const { POST } = await import('@/app/api/ai/models/route');
    const res = await POST(
      makeReq({ endpointUrl: ' https://gateway.example.com/v1 ', apiKey: ' test-key ' })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ models: ['gpt-test'] });
    expect(mockFetchModels).toHaveBeenCalledWith('https://gateway.example.com/v1', 'test-key');
  });
});
