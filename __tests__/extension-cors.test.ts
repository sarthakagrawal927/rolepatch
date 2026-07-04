import { describe, expect, it } from 'vitest';

import { extensionCorsHeaders } from '@/lib/extension-cors';
import type * as SaveJobRoute from '@/app/api/extension/save-job/route';

function makeReq(origin?: string) {
  return new Request('https://rolepatch.com/api/extension/save-job', {
    method: 'OPTIONS',
    headers: origin ? { origin } : {},
  }) as unknown as Parameters<(typeof SaveJobRoute)['OPTIONS']>[0];
}

describe('extension CORS', () => {
  it('grants credentialed CORS to Chrome extension origins', () => {
    const headers = extensionCorsHeaders(makeReq('chrome-extension://abc123'));

    expect(headers['access-control-allow-origin']).toBe('chrome-extension://abc123');
    expect(headers['access-control-allow-credentials']).toBe('true');
    expect(headers['access-control-allow-headers']).toContain('x-rolepatch-session');
    expect(headers.vary).toBe('origin');
  });

  it('does not grant browser CORS to arbitrary web origins', () => {
    const headers = extensionCorsHeaders(makeReq('https://evil.example'));

    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['access-control-allow-credentials']).toBeUndefined();
    expect(headers['access-control-allow-methods']).toBe('POST, OPTIONS');
  });

  it('uses the shared helper in extension OPTIONS responses', async () => {
    const { OPTIONS } = await import('@/app/api/extension/save-job/route');
    const res = OPTIONS(makeReq('chrome-extension://abc123'));

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('chrome-extension://abc123');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
