'use server';

import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-utils';
import { v4 as uuid } from 'uuid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TokenDebitType = 'tailor' | 'cover_letter' | 'fit_score' | 'interview_prep' | 'outreach_email';
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
 * Uses a transaction so the signup_bonus log is only written when the
 * balance row is actually created (INSERT OR IGNORE affected 1 row).
 */
export async function initializeBalance(userId: string): Promise<void> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }

  const tx = await db.transaction('write');
  try {
    const insertResult = await tx.execute({
      sql: `INSERT OR IGNORE INTO token_balances (user_id, balance, total_purchased, total_used)
            VALUES (?, 3, 0, 0)`,
      args: [userId],
    });

    // Only log the signup bonus if a new row was actually inserted
    if (insertResult.rowsAffected > 0) {
      await tx.execute({
        sql: `INSERT INTO token_transactions (id, user_id, amount, type, balance_after)
              VALUES (?, ?, 3, 'signup_bonus', 3)`,
        args: [uuid(), userId],
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * Atomically debit one token and log the transaction.
 * The UPDATE + INSERT happen inside a single write transaction so a
 * failed log INSERT rolls back the balance change.
 *
 * TODO: Add rate limiting at the middleware layer to prevent burst abuse.
 */
export async function debitToken(
  type: TokenDebitType,
  referenceId: string,
): Promise<DebitResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: 'not_authenticated' };

  // Input validation
  if (!isValidDebitType(type)) {
    validateTokenType(type, VALID_DEBIT_TYPES as ReadonlySet<TokenType>);
  }
  if (!referenceId || typeof referenceId !== 'string') {
    return { success: false, error: 'insufficient_tokens' };
  }

  const tx = await db.transaction('write');
  try {
    // Atomic check-and-decrement in one statement
    const result = await tx.execute({
      sql: `UPDATE token_balances
            SET balance = balance - 1, total_used = total_used + 1, updated_at = unixepoch()
            WHERE user_id = ? AND balance >= 1
            RETURNING balance`,
      args: [userId],
    });

    if (result.rows.length === 0) {
      await tx.rollback();
      return { success: false, error: 'insufficient_tokens' };
    }

    const newBalance = result.rows[0].balance as number;

    // Log transaction — if this fails the balance change rolls back
    await tx.execute({
      sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
            VALUES (?, ?, -1, ?, ?, ?)`,
      args: [uuid(), userId, type, referenceId, newBalance],
    });

    await tx.commit();
    return { success: true, balance: newBalance };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * Atomically credit tokens and log the transaction.
 * The upsert + SELECT + INSERT all happen inside a single write transaction.
 *
 * TODO: Add rate limiting at the middleware layer to prevent burst abuse.
 */
export async function creditTokens(
  userId: string,
  amount: number,
  type: TokenCreditType,
  referenceId?: string,
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

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO token_balances (user_id, balance, total_purchased, total_used)
            VALUES (?, ?, ?, 0)
            ON CONFLICT(user_id) DO UPDATE SET
              balance = balance + ?,
              total_purchased = total_purchased + ?,
              updated_at = unixepoch()`,
      args: [userId, amount, amount, amount, amount],
    });

    const result = await tx.execute({
      sql: 'SELECT balance FROM token_balances WHERE user_id = ?',
      args: [userId],
    });
    const newBalance = result.rows[0].balance as number;

    await tx.execute({
      sql: `INSERT INTO token_transactions (id, user_id, amount, type, reference_id, balance_after)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [uuid(), userId, amount, type, referenceId ?? null, newBalance],
    });

    await tx.commit();
    return newBalance;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
