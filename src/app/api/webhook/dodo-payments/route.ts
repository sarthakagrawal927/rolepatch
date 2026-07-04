import { headers } from 'next/headers';
import { Webhook } from 'standardwebhooks';
import { v4 as uuid } from 'uuid';

import { db } from '@/lib/db';
import { getTokensForProduct } from '@/lib/token-config';

interface DodoWebhookPayload {
  type?: string;
  data?: {
    payment_id?: string;
    metadata?: { user_id?: string };
    total_amount?: number;
    currency?: string;
    product_cart?: Array<{ product_id?: string }>;
  };
}

export async function POST(request: Request) {
  const headersList = await headers();
  const rawBody = await request.text();
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  if (!webhookKey) {
    return new Response('Webhook not configured', { status: 503 });
  }

  // Verify webhook signature
  const webhookHeaders = {
    'webhook-id': headersList.get('webhook-id') ?? '',
    'webhook-signature': headersList.get('webhook-signature') ?? '',
    'webhook-timestamp': headersList.get('webhook-timestamp') ?? '',
  };

  try {
    const wh = new Webhook(webhookKey);
    wh.verify(rawBody, webhookHeaders);
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: DodoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DodoWebhookPayload;
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }
  const eventType = payload.type ?? '';

  if (eventType === 'payment.succeeded') {
    const data = payload.data;
    const paymentId: string | undefined = data?.payment_id;
    const userId: string | undefined = data?.metadata?.user_id;
    const totalAmount: number = data?.total_amount ?? 0;
    const currency: string = data?.currency ?? 'USD';

    // Extract product_id from the cart (we only ever send 1 item)
    const productId: string | undefined = data?.product_cart?.[0]?.product_id;

    if (!userId || !productId || !paymentId) {
      return new Response('Missing required fields', { status: 400 });
    }

    const tokensToGrant = getTokensForProduct(productId);
    if (!tokensToGrant) {
      return new Response('Unknown product', { status: 400 });
    }

    // Idempotent: check if payment already processed
    const existing = await db.execute({
      sql: 'SELECT id FROM payments WHERE id = ?',
      args: [paymentId],
    });
    if (existing.rows.length > 0) {
      return new Response('Already processed', { status: 200 });
    }

    // Record payment + credit tokens atomically in one D1 batch.
    await db.batch([
      {
        sql: `INSERT INTO payments (id, user_id, product_id, amount_cents, currency, tokens_granted, status, dodo_payload)
              VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
        args: [paymentId, userId, productId, totalAmount, currency, tokensToGrant, rawBody],
      },
      {
        sql: `INSERT INTO token_balances (user_id, balance, total_purchased, total_used)
              VALUES (?, ?, ?, 0)
              ON CONFLICT(user_id) DO UPDATE SET
                balance = balance + ?,
                total_purchased = total_purchased + ?,
                updated_at = unixepoch()`,
        args: [userId, tokensToGrant, tokensToGrant, tokensToGrant, tokensToGrant],
      },
      {
        sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
              SELECT ?, ?, ?, 'purchase', ?, balance
              FROM token_balances
              WHERE user_id = ?`,
        args: [uuid(), userId, tokensToGrant, paymentId, userId],
      },
    ]);
  }

  if (eventType === 'refund.succeeded') {
    const data = payload.data;
    const paymentId: string | undefined = data?.payment_id;

    if (!paymentId) {
      return new Response('Missing payment_id', { status: 400 });
    }

    const payment = await db.execute({
      sql: 'SELECT user_id, tokens_granted FROM payments WHERE id = ? AND status = ?',
      args: [paymentId, 'completed'],
    });

    if (payment.rows.length > 0) {
      const row = payment.rows[0];
      const userId = row.user_id as string;
      const tokensToRevoke = row.tokens_granted as number;

      // Deduct tokens + mark refunded atomically in one D1 batch. Without it,
      // a failure after the deduction leaves status = 'completed', and the
      // webhook retry would deduct the tokens a second time.
      await db.batch([
        {
          sql: `UPDATE token_balances
                SET balance = MAX(0, balance - ?), updated_at = unixepoch()
                WHERE user_id = ?`,
          args: [tokensToRevoke, userId],
        },
        {
          sql: `UPDATE payments SET status = 'refunded' WHERE id = ?`,
          args: [paymentId],
        },
        {
          sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
                SELECT ?, ?, ?, 'refund', ?, COALESCE(balance, 0)
                FROM token_balances
                WHERE user_id = ?`,
          args: [uuid(), userId, -tokensToRevoke, paymentId, userId],
        },
      ]);
    }
  }

  return new Response('OK', { status: 200 });
}
