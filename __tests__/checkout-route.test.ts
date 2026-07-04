import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CheckoutRoute from '@/app/api/checkout/route';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  checkoutCreate: vi.fn(),
  dodoConstructor: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
    },
  },
}));

vi.mock('dodopayments', () => ({
  default: vi.fn(function DodoPayments(options: unknown) {
    mocks.dodoConstructor(options);
    return {
      checkoutSessions: {
        create: (...args: unknown[]) => mocks.checkoutCreate(...args),
      },
    };
  }),
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as Parameters<(typeof CheckoutRoute)['POST']>[0];
}

function makeRawReq(body: string) {
  return new Request('https://rolepatch.com/api/checkout', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  }) as Parameters<(typeof CheckoutRoute)['POST']>[0];
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('DODO_PAYMENTS_API_KEY', 'dodo_test_key');
  vi.stubEnv('DODO_PAYMENTS_ENVIRONMENT', 'test_mode');
  vi.stubEnv('DODO_PAYMENTS_RETURN_URL', 'https://rolepatch.com/pricing');
  vi.stubEnv('DODO_PRODUCT_STARTER', 'prod_starter');
  vi.stubEnv('DODO_PRODUCT_PRO', 'prod_pro');
  vi.stubEnv('DODO_PRODUCT_BULK', 'prod_bulk');
  mocks.getSession.mockReset();
  mocks.checkoutCreate.mockReset();
  mocks.checkoutCreate.mockResolvedValue({ checkout_url: 'https://checkout.example/session_1' });
  mocks.dodoConstructor.mockReset();
});

describe('POST /api/checkout', () => {
  it('rejects signed-out checkout attempts', async () => {
    mocks.getSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeReq({ packId: 'starter' }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not authenticated' });
    expect(mocks.dodoConstructor).not.toHaveBeenCalled();
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it('rejects unknown token packs before creating a checkout session', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'user_1', email: 'user@example.com', name: 'User One' },
    });

    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeReq({ packId: 'enterprise' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid pack' });
    expect(mocks.dodoConstructor).not.toHaveBeenCalled();
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before creating a checkout session', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'user_1', email: 'user@example.com', name: 'User One' },
    });

    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeRawReq('{not-json'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
    expect(mocks.dodoConstructor).not.toHaveBeenCalled();
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it('rejects non-string token packs before creating a checkout session', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'user_1', email: 'user@example.com', name: 'User One' },
    });

    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeReq({ packId: 123 }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid pack' });
    expect(mocks.dodoConstructor).not.toHaveBeenCalled();
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it('creates a Dodo checkout session for the selected pack and authenticated user', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'user_1', email: 'user@example.com', name: 'User One' },
    });

    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeReq({ packId: 'pro' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checkout_url: 'https://checkout.example/session_1' });
    expect(mocks.dodoConstructor).toHaveBeenCalledWith({
      bearerToken: 'dodo_test_key',
      environment: 'test_mode',
    });
    expect(mocks.checkoutCreate).toHaveBeenCalledWith({
      product_cart: [{ product_id: 'prod_pro', quantity: 1 }],
      customer: { email: 'user@example.com', name: 'User One' },
      return_url: 'https://rolepatch.com/pricing',
      metadata: { user_id: 'user_1' },
    });
  });

  it('returns safe config copy when checkout secrets are missing', async () => {
    vi.stubEnv('DODO_PAYMENTS_API_KEY', '');
    mocks.getSession.mockResolvedValue({
      user: { id: 'user_1', email: 'user@example.com', name: 'User One' },
    });

    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeReq({ packId: 'starter' }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'Checkout is not configured yet. Please try again later.',
      detail: { reason: 'not_configured', retryable: false },
    });
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it('maps Dodo provider failures to retryable checkout copy', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'user_1', email: 'user@example.com', name: 'User One' },
    });
    mocks.checkoutCreate.mockRejectedValue(new Error('Dodo HTTP 503 raw provider details'));

    const { POST } = await import('@/app/api/checkout/route');
    const res = await POST(makeReq({ packId: 'starter' }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json).toEqual({
      error: 'Checkout is temporarily unavailable. Try again in a few minutes.',
      detail: { reason: 'provider_unavailable', retryable: true },
    });
    expect(json.error).not.toContain('Dodo');
    expect(json.error).not.toContain('503');
  });
});
