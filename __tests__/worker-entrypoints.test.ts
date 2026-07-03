import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workerSource = readFileSync(join(process.cwd(), 'worker.mjs'), 'utf8');

describe('custom Cloudflare worker entrypoint', () => {
  it('wires scheduled cron tasks through internal routes', () => {
    expect(workerSource).toContain('async scheduled(event, env, ctx)');
    expect(workerSource).toContain('/api/internal/cron/company-watchlist');
    expect(workerSource).toContain('/api/internal/cron/weekly-digest');
    expect(workerSource).toContain('0 13 * * *');
    expect(workerSource).toContain('0 14 * * 1');
  });

  it('wires Email Routing into recruiter reply ingest and blocks external internal routes', () => {
    expect(workerSource).toContain('async email(message, env, ctx)');
    expect(workerSource).toContain('/api/internal/email/recruiter-reply');
    expect(workerSource).toContain('url.pathname.startsWith(INTERNAL_PATH_PREFIX)');
    expect(workerSource).toContain("return new Response('Not found', { status: 404 })");
  });
});
