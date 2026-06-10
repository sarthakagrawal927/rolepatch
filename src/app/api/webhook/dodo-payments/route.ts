import { headers } from 'next/headers';
import { Webhook } from 'standardwebhooks';
import { v4 as uuid } from 'uuid';

import { db } from '@/lib/db';
import { getTokensForProduct } from '@/lib/token-config';

export async function POST(request: Request) {
  const headersList = await headers();
  const rawBody = await request.text();

  // Verify webhook signature
  const webhookHeaders = {
    'webhook-id': headersList.get('webhook-id') ?? '',
    'webhook-signature': headersList.get('webhook-signature') ?? '',
    'webhook-timestamp': headersList.get('webhook-timestamp') ?? '',
  };

  try {
    const wh = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_KEY!);
    wh.verify(rawBody, webhookHeaders);
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventType: string = payload.type;

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

    // Record payment + credit tokens in a single transaction
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: `INSERT INTO payments (id, user_id, product_id, amount_cents, currency, tokens_granted, status, dodo_payload)
              VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
        args: [paymentId, userId, productId, totalAmount, currency, tokensToGrant, rawBody],
      });

      await tx.execute({
        sql: `INSERT INTO token_balances (user_id, balance, total_purchased, total_used)
              VALUES (?, ?, ?, 0)
              ON CONFLICT(user_id) DO UPDATE SET
                balance = balance + ?,
                total_purchased = total_purchased + ?,
                updated_at = unixepoch()`,
        args: [userId, tokensToGrant, tokensToGrant, tokensToGrant, tokensToGrant],
      });

      const balResult = await tx.execute({
        sql: 'SELECT balance FROM token_balances WHERE user_id = ?',
        args: [userId],
      });
      const newBalance = balResult.rows[0].balance as number;

      await tx.execute({
        sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
              VALUES (?, ?, ?, 'purchase', ?, ?)`,
        args: [uuid(), userId, tokensToGrant, paymentId, newBalance],
      });

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
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

      // Deduct tokens + mark refunded in a single transaction. Without it,
      // a failure after the deduction leaves status = 'completed', and the
      // webhook retry would deduct the tokens a second time.
      const tx = await db.transaction('write');
      try {
        // Deduct tokens (floor at 0 to avoid negative balance)
        await tx.execute({
          sql: `UPDATE token_balances
                SET balance = MAX(0, balance - ?), updated_at = unixepoch()
                WHERE user_id = ?`,
          args: [tokensToRevoke, userId],
        });

        await tx.execute({
          sql: `UPDATE payments SET status = 'refunded' WHERE id = ?`,
          args: [paymentId],
        });

        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    }
  }

  return new Response('OK', { status: 200 });
}
