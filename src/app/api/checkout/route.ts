import DodoPayments from 'dodopayments';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getProductId } from '@/lib/token-config';

let _client: DodoPayments | null = null;

type CheckoutErrorReason = 'not_configured' | 'provider_unavailable';

class CheckoutServiceError extends Error {
  reason: CheckoutErrorReason;
  retryable: boolean;

  constructor(reason: CheckoutErrorReason, message: string, retryable: boolean) {
    super(message);
    this.name = 'CheckoutServiceError';
    this.reason = reason;
    this.retryable = retryable;
  }
}

function getClient() {
  if (!process.env.DODO_PAYMENTS_API_KEY) {
    throw new CheckoutServiceError(
      'not_configured',
      'Checkout is not configured yet. Please try again later.',
      false
    );
  }
  if (!_client) {
    _client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY,
      environment:
        (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') ?? 'test_mode',
    });
  }
  return _client;
}

function checkoutErrorResponse(error: unknown) {
  if (error instanceof CheckoutServiceError) {
    return NextResponse.json(
      {
        error: error.message,
        detail: { reason: error.reason, retryable: error.retryable },
      },
      { status: error.reason === 'not_configured' ? 503 : 502 }
    );
  }

  return NextResponse.json(
    {
      error: 'Checkout is temporarily unavailable. Try again in a few minutes.',
      detail: { reason: 'provider_unavailable', retryable: true },
    },
    { status: 502 }
  );
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const packId =
    typeof body === 'object' && body !== null && 'packId' in body
      ? (body as { packId?: unknown }).packId
      : undefined;
  if (typeof packId !== 'string') {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const productId = getProductId(packId);
  if (!productId) {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const { id: userId, email, name } = session.user;

  try {
    if (!process.env.DODO_PAYMENTS_RETURN_URL) {
      throw new CheckoutServiceError(
        'not_configured',
        'Checkout is not configured yet. Please try again later.',
        false
      );
    }

    const client = getClient();
    const checkoutSession = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email, name: name ?? '' },
      return_url: process.env.DODO_PAYMENTS_RETURN_URL,
      metadata: { user_id: userId },
    });

    return NextResponse.json({ checkout_url: checkoutSession.checkout_url });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
