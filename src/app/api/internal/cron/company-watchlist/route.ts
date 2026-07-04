import { NextResponse } from 'next/server';

import {
  type CompanyWatchDbRow,
  runCompanyWatchForUser,
} from '@/lib/actions/job-discovery-actions';
import { db } from '@/lib/db';
import { isInternalWorkerRequest } from '@/lib/internal-route-auth';
import type { CompanyWatch } from '@/lib/types';

// Invoked only by worker.mjs scheduled(). External /api/internal/* requests
// are blocked by the Worker before OpenNext receives them.

function parseResultIds(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toCompanyWatch(row: CompanyWatchDbRow): CompanyWatch {
  return {
    id: row.id,
    company: row.company,
    career_url: row.career_url,
    role_query: row.role_query,
    location: row.location,
    remote: row.remote === 1,
    paused: row.paused === 1,
    last_run_at: row.last_run_at,
    last_result_ids: parseResultIds(row.last_result_ids),
    last_source: row.last_source ?? null,
    last_found_count: row.last_found_count ?? null,
    last_error: row.last_error ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function POST(req: Request) {
  if (!isInternalWorkerRequest(req.headers)) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const result = await db.execute({
    sql: `SELECT * FROM company_watches
          WHERE paused = 0
          ORDER BY COALESCE(last_run_at, 0) ASC, updated_at ASC
          LIMIT 100`,
    args: [],
  });

  let alerts = 0;
  let failed = 0;
  for (const row of result.rows as unknown as CompanyWatchDbRow[]) {
    try {
      alerts += await runCompanyWatchForUser(toCompanyWatch(row), row.user_id);
    } catch (err) {
      failed++;
      console.error(`[company-watchlist] watch ${row.id} failed`, err);
    }
  }

  console.log(
    `[company-watchlist] watches=${result.rows.length} alerts=${alerts} failed=${failed}`
  );
  return NextResponse.json({ watches: result.rows.length, alerts, failed });
}
