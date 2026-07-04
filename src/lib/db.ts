// Minimal D1 client wrapper. Keeps the app-level db.execute/db.batch API
// stable around the Cloudflare D1 binding.

import { getCloudflareContext } from '@opennextjs/cloudflare';

type SqlArg = string | number | bigint | boolean | null | Uint8Array;

interface ExecuteArgs {
  sql: string;
  args?: readonly SqlArg[] | SqlArg[];
}

type RowValue = string | number | null | Uint8Array;

type Row = Record<string, RowValue> & {
  [index: number]: RowValue;
};

interface D1Meta {
  changes?: number;
  last_row_id?: number;
}

interface D1Result {
  results?: Record<string, RowValue>[];
  meta?: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: SqlArg[]): D1PreparedStatement;
  all<T = Record<string, RowValue>>(): Promise<{ results?: T[]; meta?: D1Meta }>;
  run(): Promise<{ results?: Record<string, RowValue>[]; meta?: D1Meta }>;
}

interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface CloudflareEnv {
  DB?: D1DatabaseLike;
}

export interface ExecuteResult {
  rows: Row[];
  columns: string[];
  rowsAffected: number;
  lastInsertRowid: bigint | null;
}

function getD1Binding(): D1DatabaseLike {
  try {
    const { env } = getCloudflareContext({ async: false });
    const db = (env as CloudflareEnv | undefined)?.DB;
    if (db) return db;
  } catch {
    // Outside OpenNext/Workers, there is no D1 binding. Throw below with a
    // precise setup error rather than leaking an OpenNext context failure.
  }
  throw new Error('Cloudflare D1 binding DB is not configured');
}

function coerceArg(value: SqlArg): SqlArg {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function rowWithNumericIndexes(row: Record<string, RowValue>, columns: string[]): Row {
  const out = { ...row } as Row;
  columns.forEach((column, index) => {
    out[index] = row[column] ?? null;
  });
  return out;
}

function statementReturnsRows(sql: string): boolean {
  const normalized = sql
    .trim()
    .replace(/^\/\*[\s\S]*?\*\//, '')
    .trim();
  const firstKeyword = normalized.match(/^([a-z]+)/i)?.[1]?.toUpperCase();
  return (
    firstKeyword === 'SELECT' ||
    firstKeyword === 'PRAGMA' ||
    firstKeyword === 'EXPLAIN' ||
    firstKeyword === 'WITH' ||
    /\bRETURNING\b/i.test(normalized)
  );
}

async function executeD1(db: D1DatabaseLike, input: ExecuteArgs | string): Promise<ExecuteResult> {
  const sql = typeof input === 'string' ? input : input.sql;
  const args = typeof input === 'string' ? [] : [...(input.args ?? [])].map(coerceArg);
  const statement = db.prepare(sql);
  const boundStatement = args.length > 0 ? statement.bind(...args) : statement;
  const payload = (
    statementReturnsRows(sql) ? await boundStatement.all() : await boundStatement.run()
  ) as D1Result;
  const rawRows = payload.results ?? [];
  const columns = rawRows[0] ? Object.keys(rawRows[0]) : [];

  return {
    columns,
    rows: rawRows.map((row) => rowWithNumericIndexes(row, columns)),
    rowsAffected: payload.meta?.changes ?? 0,
    lastInsertRowid:
      payload.meta?.last_row_id === undefined || payload.meta.last_row_id === null
        ? null
        : BigInt(payload.meta.last_row_id),
  };
}

async function batchD1(
  db: D1DatabaseLike,
  inputs: Array<ExecuteArgs | string>
): Promise<ExecuteResult[]> {
  const statements = inputs.map((input) => {
    const sql = typeof input === 'string' ? input : input.sql;
    const args = typeof input === 'string' ? [] : [...(input.args ?? [])].map(coerceArg);
    const statement = db.prepare(sql);
    return args.length > 0 ? statement.bind(...args) : statement;
  });
  const payloads = await db.batch(statements);
  return payloads.map((payload) => {
    const rawRows = payload.results ?? [];
    const columns = rawRows[0] ? Object.keys(rawRows[0]) : [];
    return {
      columns,
      rows: rawRows.map((row) => rowWithNumericIndexes(row, columns)),
      rowsAffected: payload.meta?.changes ?? 0,
      lastInsertRowid:
        payload.meta?.last_row_id === undefined || payload.meta.last_row_id === null
          ? null
          : BigInt(payload.meta.last_row_id),
    };
  });
}

class D1Client {
  async execute(input: ExecuteArgs | string): Promise<ExecuteResult> {
    return executeD1(getD1Binding(), input);
  }

  async batch(inputs: Array<ExecuteArgs | string>): Promise<ExecuteResult[]> {
    return batchD1(getD1Binding(), inputs);
  }
}

export const db = new D1Client();
