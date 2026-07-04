import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DodoWebhookRoute from '@/app/api/webhook/dodo-payments/route';

const mocks = vi.hoisted(() => ({
  headersGet: vi.fn(),
  verify: vi.fn(),
  dbExecute: vi.fn(),
  dbTransaction: vi.fn(),
  uuid: vi.fn(() => 'token-tx-1'),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (...args: unknown[]) => mocks.headersGet(...args) }),
}));

vi.mock('standardwebhooks', () => ({
  Webhook: vi.fn(function Webhook() {
    return {
      verify: (...args: unknown[]) => mocks.verify(...args),
    };
  }),
}));

vi.mock('uuid', () => ({
  v4: () => mocks.uuid(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    execute: (...args: unknown[]) => mocks.dbExecute(...args),
    transaction: (...args: unknown[]) => mocks.dbTransaction(...args),
  },
}));

function makeReq(body: unknown) {
  return new Request('https://rolepatch.com/api/webhook/dodo-payments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as Parameters<(typeof DodoWebhookRoute)['POST']>[0];
}

function makeRawReq(body: string) {
  return new Request('https://rolepatch.com/api/webhook/dodo-payments', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  }) as Parameters<(typeof DodoWebhookRoute)['POST']>[0];
}

function makeTx() {
  const tx = {
    execute: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };
  mocks.dbTransaction.mockResolvedValue(tx);
  return tx;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('DODO_PAYMENTS_WEBHOOK_KEY', 'whsec_test');
  vi.stubEnv('DODO_PRODUCT_STARTER', 'prod_starter');
  vi.stubEnv('DODO_PRODUCT_PRO', 'prod_pro');
  vi.stubEnv('DODO_PRODUCT_BULK', 'prod_bulk');
  mocks.headersGet.mockReset();
  mocks.headersGet.mockReturnValue('header-value');
  mocks.verify.mockReset();
  mocks.verify.mockReturnValue(undefined);
  mocks.dbExecute.mockReset();
  mocks.dbExecute.mockResolvedValue({ rows: [] });
  mocks.dbTransaction.mockReset();
  mocks.uuid.mockClear();
});

describe('POST /api/webhook/dodo-payments', () => {
  it('fails closed when the webhook secret is not configured', async () => {
    vi.stubEnv('DODO_PAYMENTS_WEBHOOK_KEY', '');

    const { POST } = await import('@/app/api/webhook/dodo-payments/route');
    const res = await POST(makeReq({ type: 'payment.succeeded', data: {} }));

    expect(res.status).toBe(503);
    expect(await res.text()).toBe('Webhook not configured');
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.dbExecute).not.toHaveBeenCalled();
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook signatures before touching the database', async () => {
    mocks.verify.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const { POST } = await import('@/app/api/webhook/dodo-payments/route');
    const res = await POST(makeReq({ type: 'payment.succeeded', data: {} }));

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Invalid signature');
    expect(mocks.dbExecute).not.toHaveBeenCalled();
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('rejects malformed verified payloads before touching the database', async () => {
    const { POST } = await import('@/app/api/webhook/dodo-payments/route');
    const res = await POST(makeRawReq('{not-json'));

    expect(res.status).toBe(400);
    expect(await res.text()).toBe('Invalid payload');
    expect(mocks.verify).toHaveBeenCalled();
    expect(mocks.dbExecute).not.toHaveBeenCalled();
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('credits tokens for a new successful payment in one transaction', async () => {
    const tx = makeTx();
    tx.execute.mockImplementation(async (statement: { sql: string }) => {
      if (statement.sql.includes('SELECT balance FROM token_balances')) {
        return { rows: [{ balance: 13 }] };
      }
      return { rows: [] };
    });

    const { POST } = await import('@/app/api/webhook/dodo-payments/route');
    const res = await POST(
      makeReq({
        type: 'payment.succeeded',
        data: {
          payment_id: 'pay_1',
          metadata: { user_id: 'user_1' },
          total_amount: 500,
          currency: 'USD',
          product_cart: [{ product_id: 'prod_starter' }],
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.dbExecute).toHaveBeenCalledWith({
      sql: 'SELECT id FROM payments WHERE id = ?',
      args: ['pay_1'],
    });
    expect(mocks.dbTransaction).toHaveBeenCalledWith('write');
    expect(tx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['pay_1', 'user_1', 'prod_starter', 500, 'USD', 10, expect.any(String)],
      })
    );
    expect(tx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['user_1', 10, 10, 10, 10],
      })
    );
    expect(tx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['token-tx-1', 'user_1', 10, 'pay_1', 13],
      })
    );
    expect(tx.commit).toHaveBeenCalledTimes(1);
    expect(tx.rollback).not.toHaveBeenCalled();
  });

  it('does not grant tokens again for an already processed payment', async () => {
    mocks.dbExecute.mockResolvedValue({ rows: [{ id: 'pay_1' }] });

    const { POST } = await import('@/app/api/webhook/dodo-payments/route');
    const res = await POST(
      makeReq({
        type: 'payment.succeeded',
        data: {
          payment_id: 'pay_1',
          metadata: { user_id: 'user_1' },
          product_cart: [{ product_id: 'prod_starter' }],
        },
      })
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Already processed');
    expect(mocks.dbTransaction).not.toHaveBeenCalled();
  });

  it('deducts refunded payment tokens and records a refund transaction', async () => {
    const tx = makeTx();
    tx.execute.mockImplementation(async (statement: { sql: string }) => {
      if (statement.sql.includes('SELECT balance FROM token_balances')) {
        return { rows: [{ balance: 2 }] };
      }
      return { rows: [] };
    });
    mocks.dbExecute.mockResolvedValue({
      rows: [{ user_id: 'user_1', tokens_granted: 10 }],
    });

    const { POST } = await import('@/app/api/webhook/dodo-payments/route');
    const res = await POST(makeReq({ type: 'refund.succeeded', data: { payment_id: 'pay_1' } }));

    expect(res.status).toBe(200);
    expect(tx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [10, 'user_1'],
      })
    );
    expect(tx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: 'SELECT balance FROM token_balances WHERE user_id = ?',
        args: ['user_1'],
      })
    );
    expect(tx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['pay_1'],
      })
    );
    expect(tx.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        args: ['token-tx-1', 'user_1', -10, 'pay_1', 2],
      })
    );
    expect(tx.commit).toHaveBeenCalledTimes(1);
    expect(tx.rollback).not.toHaveBeenCalled();
  });

  it('rolls back a refund transaction when marking the payment refunded fails', async () => {
    const tx = makeTx();
    const writeFailure = new Error('write failed');
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ balance: 0 }] })
      .mockRejectedValueOnce(writeFailure);
    mocks.dbExecute.mockResolvedValue({
      rows: [{ user_id: 'user_1', tokens_granted: 10 }],
    });

    const { POST } = await import('@/app/api/webhook/dodo-payments/route');
    await expect(
      POST(makeReq({ type: 'refund.succeeded', data: { payment_id: 'pay_1' } }))
    ).rejects.toThrow(writeFailure);

    expect(mocks.dbExecute).toHaveBeenCalledWith({
      sql: 'SELECT user_id, tokens_granted FROM payments WHERE id = ? AND status = ?',
      args: ['pay_1', 'completed'],
    });
    expect(mocks.dbTransaction).toHaveBeenCalledWith('write');
    expect(tx.rollback).toHaveBeenCalledTimes(1);
    expect(tx.commit).not.toHaveBeenCalled();
  });
});
