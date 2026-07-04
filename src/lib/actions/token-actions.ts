'use server';

import { v4 as uuid } from 'uuid';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TokenDebitType =
  | 'tailor'
  | 'cover_letter'
  | 'fit_score'
  | 'interview_prep'
  | 'outreach_email';
export type TokenCreditType = 'purchase' | 'refund' | 'signup_bonus';
type TokenType = TokenDebitType | TokenCreditType;

export type DebitResult =
  | { success: true; balance: number }
  | { success: false; error: 'insufficient_tokens' | 'not_authenticated' };

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_DEBIT_TYPES: ReadonlySet<TokenDebitType> = new Set([
  'tailor',
  'cover_letter',
  'fit_score',
  'interview_prep',
  'outreach_email',
]);

const VALID_CREDIT_TYPES: ReadonlySet<TokenCreditType> = new Set([
  'purchase',
  'refund',
  'signup_bonus',
]);

function isValidDebitType(t: string): t is TokenDebitType {
  return VALID_DEBIT_TYPES.has(t as TokenDebitType);
}

function isValidCreditType(t: string): t is TokenCreditType {
  return VALID_CREDIT_TYPES.has(t as TokenCreditType);
}

function validateTokenType(t: string, allowed: ReadonlySet<TokenType>): void {
  if (!allowed.has(t as TokenType)) {
    throw new Error('Invalid token operation type');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read-only balance check. Safe to call without transactions.
 */
export async function getTokenBalance(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const result = await db.execute({
    sql: 'SELECT balance FROM token_balances WHERE user_id = ?',
    args: [userId],
  });

  return (result.rows[0]?.balance as number) ?? 0;
}

/**
 * Idempotent balance initialization for new users.
 * Uses a D1 batch so the signup_bonus log is only written when the
 * balance row is actually created.
 */
export async function initializeBalance(userId: string): Promise<void> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }

  await db.batch([
    {
      sql: `INSERT OR IGNORE INTO token_balances (user_id, balance, total_purchased, total_used)
            VALUES (?, 3, 0, 0)`,
      args: [userId],
    },
    {
      sql: `INSERT INTO token_transactions (id, user_id, amount, type, balance_after)
            SELECT ?, ?, 3, 'signup_bonus', 3
            WHERE changes() > 0`,
      args: [uuid(), userId],
    },
  ]);
}

/**
 * Atomically debit one token and log the transaction in a D1 batch.
 *
 * Burst abuse should be handled with narrow, evidence-backed controls around
 * token-spending endpoints rather than broad middleware throttling.
 */
export async function debitToken(type: TokenDebitType, referenceId: string): Promise<DebitResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'not_authenticated' };

  // Input validation
  if (!isValidDebitType(type)) {
    validateTokenType(type, VALID_DEBIT_TYPES as ReadonlySet<TokenType>);
  }
  if (!referenceId || typeof referenceId !== 'string') {
    return { success: false, error: 'insufficient_tokens' };
  }

  const [debitResult] = await db.batch([
    {
      sql: `UPDATE token_balances
            SET balance = balance - 1, total_used = total_used + 1, updated_at = unixepoch()
            WHERE user_id = ? AND balance >= 1
            RETURNING balance`,
      args: [userId],
    },
    {
      sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
            SELECT ?, ?, -1, ?, ?, balance
            FROM token_balances
            WHERE user_id = ? AND changes() > 0`,
      args: [uuid(), userId, type, referenceId, userId],
    },
  ]);

  if (!debitResult || debitResult.rows.length === 0) {
    return { success: false, error: 'insufficient_tokens' };
  }
  return { success: true, balance: debitResult.rows[0].balance as number };
}

/**
 * Atomically credit tokens and log the transaction in a D1 batch.
 *
 * Burst abuse should be handled with narrow, evidence-backed controls around
 * token-crediting endpoints rather than broad middleware throttling.
 */
export async function creditTokens(
  userId: string,
  amount: number,
  type: TokenCreditType,
  referenceId?: string
): Promise<number> {
  // Input validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }
  if (!isValidCreditType(type)) {
    validateTokenType(type, VALID_CREDIT_TYPES as ReadonlySet<TokenType>);
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Amount must be a positive integer');
  }

  const results = await db.batch([
    {
      sql: `INSERT INTO token_balances (user_id, balance, total_purchased, total_used)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(user_id) DO UPDATE SET
              balance = balance + ?,
              total_purchased = total_purchased + ?,
              updated_at = unixepoch()`,
      args: [userId, amount, amount, amount, amount],
    },
    {
      sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
            SELECT ?, ?, ?, ?, ?, balance
            FROM token_balances
            WHERE user_id = ?`,
      args: [uuid(), userId, amount, type, referenceId ?? null, userId],
    },
    {
      sql: 'SELECT balance FROM token_balances WHERE user_id = ?',
      args: [userId],
    },
  ]);

  return results[2]?.rows[0]?.balance as number;
}
