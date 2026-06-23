import { betterAuth } from 'better-auth';
import { createAdapter } from 'better-auth/adapters';

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Lightweight SQLite adapter backed by the existing Turso HTTP client.
// Avoids pulling @libsql/client + drizzle into the CF Worker bundle.
// ---------------------------------------------------------------------------

type SqlArg = string | number | boolean | null;

function buildWhere(
  where: Array<{ field: string; operator?: string; value: unknown; connector?: string }>
): { sql: string; args: SqlArg[] } {
  if (!where.length) return { sql: '', args: [] };
  const parts: string[] = [];
  const args: SqlArg[] = [];
  for (const w of where) {
    const op = w.operator ?? 'eq';
    const val = w.value;
    const connector = w.connector === 'OR' ? 'OR' : 'AND';
    if (parts.length) parts.push(connector);
    switch (op) {
      case 'eq':
        parts.push(`"${w.field}" = ?`);
        args.push(val as SqlArg);
        break;
      case 'ne':
        parts.push(`"${w.field}" != ?`);
        args.push(val as SqlArg);
        break;
      case 'lt':
        parts.push(`"${w.field}" < ?`);
        args.push(val as SqlArg);
        break;
      case 'lte':
        parts.push(`"${w.field}" <= ?`);
        args.push(val as SqlArg);
        break;
      case 'gt':
        parts.push(`"${w.field}" > ?`);
        args.push(val as SqlArg);
        break;
      case 'gte':
        parts.push(`"${w.field}" >= ?`);
        args.push(val as SqlArg);
        break;
      case 'in':
        parts.push(`"${w.field}" IN (${(val as unknown[]).map(() => '?').join(',')})`);
        args.push(...(val as SqlArg[]));
        break;
      case 'not_in':
        parts.push(`"${w.field}" NOT IN (${(val as unknown[]).map(() => '?').join(',')})`);
        args.push(...(val as SqlArg[]));
        break;
      case 'contains':
        parts.push(`"${w.field}" LIKE ?`);
        args.push(`%${val}%`);
        break;
      case 'starts_with':
        parts.push(`"${w.field}" LIKE ?`);
        args.push(`${val}%`);
        break;
      case 'ends_with':
        parts.push(`"${w.field}" LIKE ?`);
        args.push(`%${val}`);
        break;
      default:
        parts.push(`"${w.field}" = ?`);
        args.push(val as SqlArg);
    }
  }
  return { sql: parts.join(' '), args };
}

const tursoAdapter = createAdapter({
  config: {
    adapterId: 'turso-http',
    adapterName: 'Turso HTTP',
    supportsNumericIds: false,
    supportsJSON: false,
    supportsDates: false,
    supportsBooleans: false,
    transaction: false,
  },
  adapter: ({ getDefaultModelName }) => ({
    async create({ model, data, select }) {
      const table = getDefaultModelName(model);
      const id = (data as any).id ?? crypto.randomUUID();
      const row = { id, ...data };
      const cols = Object.keys(row);
      const placeholders = cols.map(() => '?');
      const args = Object.values(row).map((v) =>
        v instanceof Date ? v.toISOString() : (v as SqlArg)
      );
      await db.execute({
        sql: `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${placeholders.join(',')})`,
        args,
      });
      const result = await db.execute({
        sql: `SELECT * FROM "${table}" WHERE "id" = ?`,
        args: [id],
      });
      const out = result.rows[0] ?? {};
      if (select?.length) return Object.fromEntries(select.map((k) => [k, out[k]])) as any;
      return out as any;
    },

    async findOne({ model, where, select }) {
      const table = getDefaultModelName(model);
      const { sql: whereSql, args } = buildWhere(where as any[]);
      const result = await db.execute({
        sql: `SELECT * FROM "${table}"${whereSql ? ` WHERE ${whereSql}` : ''} LIMIT 1`,
        args,
      });
      if (!result.rows.length) return null;
      const out = result.rows[0];
      if (select?.length) return Object.fromEntries(select.map((k) => [k, out[k]])) as any;
      return out as any;
    },

    async findMany({ model, where, limit, offset, sortBy }) {
      const table = getDefaultModelName(model);
      const { sql: whereSql, args } = buildWhere((where ?? []) as any[]);
      let sql = `SELECT * FROM "${table}"`;
      if (whereSql) sql += ` WHERE ${whereSql}`;
      if (sortBy)
        sql += ` ORDER BY "${(sortBy as any).field}" ${(sortBy as any).direction === 'desc' ? 'DESC' : 'ASC'}`;
      if (limit) sql += ` LIMIT ${limit}`;
      if (offset) sql += ` OFFSET ${offset}`;
      const result = await db.execute({ sql, args });
      return result.rows as any[];
    },

    async update({ model, where, update }) {
      const table = getDefaultModelName(model);
      if (!Object.keys(update as object).length) return null;
      const setCols = Object.keys(update as object)
        .map((k) => `"${k}" = ?`)
        .join(', ');
      const setArgs = Object.values(update as object).map((v) =>
        v instanceof Date ? v.toISOString() : (v as SqlArg)
      );
      const { sql: whereSql, args: whereArgs } = buildWhere(where as any[]);
      await db.execute({
        sql: `UPDATE "${table}" SET ${setCols}${whereSql ? ` WHERE ${whereSql}` : ''}`,
        args: [...setArgs, ...whereArgs],
      });
      const result = await db.execute({
        sql: `SELECT * FROM "${table}"${whereSql ? ` WHERE ${whereSql}` : ''} LIMIT 1`,
        args: whereArgs,
      });
      return (result.rows[0] ?? null) as any;
    },

    async updateMany({ model, where, update }) {
      const table = getDefaultModelName(model);
      if (!Object.keys(update as object).length) return 0;
      const setCols = Object.keys(update as object)
        .map((k) => `"${k}" = ?`)
        .join(', ');
      const setArgs = Object.values(update as object).map((v) =>
        v instanceof Date ? v.toISOString() : (v as SqlArg)
      );
      const { sql: whereSql, args: whereArgs } = buildWhere(where as any[]);
      const r = await db.execute({
        sql: `UPDATE "${table}" SET ${setCols}${whereSql ? ` WHERE ${whereSql}` : ''}`,
        args: [...setArgs, ...whereArgs],
      });
      return r.rowsAffected;
    },

    async delete({ model, where }) {
      const table = getDefaultModelName(model);
      const { sql: whereSql, args } = buildWhere(where as any[]);
      await db.execute({
        sql: `DELETE FROM "${table}"${whereSql ? ` WHERE ${whereSql}` : ''}`,
        args,
      });
    },

    async deleteMany({ model, where }) {
      const table = getDefaultModelName(model);
      const { sql: whereSql, args } = buildWhere(where as any[]);
      const r = await db.execute({
        sql: `DELETE FROM "${table}"${whereSql ? ` WHERE ${whereSql}` : ''}`,
        args,
      });
      return r.rowsAffected;
    },

    async count({ model, where }) {
      const table = getDefaultModelName(model);
      const { sql: whereSql, args } = buildWhere((where ?? []) as any[]);
      const result = await db.execute({
        sql: `SELECT COUNT(*) as cnt FROM "${table}"${whereSql ? ` WHERE ${whereSql}` : ''}`,
        args,
      });
      return (result.rows[0]?.cnt as number) ?? 0;
    },
  }),
});

const canUseLocalAuthSecret =
  process.env.NODE_ENV !== 'production' ||
  process.env.npm_lifecycle_event === 'build' ||
  process.env.NEXT_PHASE === 'phase-production-build';

const authSecret =
  process.env.BETTER_AUTH_SECRET?.trim() ||
  (canUseLocalAuthSecret ? 'resume-tailor-local-development-secret-32-chars' : undefined);
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

export const auth = betterAuth({
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL,
  database: tursoAdapter,
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
  trustedOrigins: [process.env.BETTER_AUTH_URL || ''],
});
