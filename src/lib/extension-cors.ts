import type { NextRequest } from 'next/server';

export function extensionCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const headers: Record<string, string> = {
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-rolepatch-session',
    'access-control-max-age': '86400',
    vary: 'origin',
  };

  if (origin.startsWith('chrome-extension://')) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
  }

  return headers;
}
