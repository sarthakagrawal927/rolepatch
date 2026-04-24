import { NextRequest, NextResponse } from 'next/server';
import DodoPayments from 'dodopayments';
import { auth } from '@/lib/auth';
import { getProductId } from '@/lib/token-config';

let _client: DodoPayments | null = null;

function getClient() {
  if (!_client) {
    _client = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
      environment:
        (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') ??
        'test_mode',
    });
  }
  return _client;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { packId } = await request.json();
  const productId = getProductId(packId);
  if (!productId) {
    return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  const client = getClient();
  const checkoutSession = await client.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { email: session.user.email, name: session.user.name ?? '' },
    return_url: process.env.DODO_PAYMENTS_RETURN_URL!,
    metadata: { user_id: userId },
  });

  return NextResponse.json({ checkout_url: checkoutSession.checkout_url });
}
