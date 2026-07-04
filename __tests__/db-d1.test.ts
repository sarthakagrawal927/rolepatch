import { afterEach, describe, expect, it, vi } from 'vitest';

type SqlArg = string | number | bigint | boolean | null | Uint8Array;

const mockContext = vi.hoisted(() => ({
  env: {} as { DB?: ReturnType<typeof createFakeD1> },
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(() => ({ env: mockContext.env })),
}));

function createFakeD1() {
  const calls: Array<{ method: 'all' | 'run'; sql: string; args: SqlArg[] }> = [];
  const payloads: Array<{
    results?: Record<string, string | number | null>[];
    meta?: { changes?: number; last_row_id?: number };
  }> = [];

  return {
    calls,
    payloads,
    prepare: vi.fn((sql: string) => {
      const statement = {
        args: [] as SqlArg[],
        bind: vi.fn((...args: SqlArg[]) => {
          statement.args = args;
          return statement;
        }),
        all: vi.fn(async () => {
          calls.push({ method: 'all', sql, args: statement.args });
          return payloads.shift() ?? {};
        }),
        run: vi.fn(async () => {
          calls.push({ method: 'run', sql, args: statement.args });
          return payloads.shift() ?? {};
        }),
      };
      return statement;
    }),
  };
}

describe('D1 db wrapper', () => {
  afterEach(() => {
    mockContext.env = {};
    vi.resetModules();
  });

  it('uses prepared all() for row-returning statements and preserves numeric indexes', async () => {
    const fakeD1 = createFakeD1();
    mockContext.env = { DB: fakeD1 };
    fakeD1.payloads.push({
      results: [{ id: 'u1', balance: 3 }],
      meta: { changes: 0 },
    });

    const { db } = await import('@/lib/db');
    const result = await db.execute({
      sql: 'SELECT id, balance FROM token_balances WHERE user_id = ?',
      args: ['u1'],
    });

    expect(fakeD1.calls).toEqual([
      {
        method: 'all',
        sql: 'SELECT id, balance FROM token_balances WHERE user_id = ?',
        args: ['u1'],
      },
    ]);
    expect(result.columns).toEqual(['id', 'balance']);
    expect(result.rows[0]).toMatchObject({ id: 'u1', balance: 3, 0: 'u1', 1: 3 });
    expect(result.rowsAffected).toBe(0);
    expect(result.lastInsertRowid).toBeNull();
  });

  it('uses run() for non-returning writes and maps D1 metadata', async () => {
    const fakeD1 = createFakeD1();
    mockContext.env = { DB: fakeD1 };
    fakeD1.payloads.push({ meta: { changes: 1, last_row_id: 42 } });

    const { db } = await import('@/lib/db');
    const result = await db.execute({
      sql: 'INSERT INTO token_balances (user_id, balance) VALUES (?, ?)',
      args: ['u1', 3],
    });

    expect(fakeD1.calls).toEqual([
      {
        method: 'run',
        sql: 'INSERT INTO token_balances (user_id, balance) VALUES (?, ?)',
        args: ['u1', 3],
      },
    ]);
    expect(result.rows).toEqual([]);
    expect(result.rowsAffected).toBe(1);
    expect(result.lastInsertRowid).toBe(42n);
  });

  it('keeps RETURNING writes on all() so callers can read returned rows', async () => {
    const fakeD1 = createFakeD1();
    mockContext.env = { DB: fakeD1 };
    fakeD1.payloads.push({
      results: [{ balance: 2 }],
      meta: { changes: 1 },
    });

    const { db } = await import('@/lib/db');
    const result = await db.execute({
      sql: 'UPDATE token_balances SET balance = balance - 1 WHERE user_id = ? RETURNING balance',
      args: ['u1'],
    });

    expect(fakeD1.calls[0]?.method).toBe('all');
    expect(result.rows[0]?.balance).toBe(2);
    expect(result.rowsAffected).toBe(1);
  });

  it('throws a setup-specific error when the DB binding is missing', async () => {
    const { db } = await import('@/lib/db');

    await expect(db.execute('SELECT 1')).rejects.toThrow(
      'Cloudflare D1 binding DB is not configured'
    );
  });
});
