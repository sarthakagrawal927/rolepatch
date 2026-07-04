#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://rolepatch.com';
const DEFAULT_TIMEOUT_MS = 10_000;

export function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  const parsed = new URL(value);
  return parsed.toString().replace(/\/$/, '');
}

export function buildSmokeChecks({ hasSessionCookie = false } = {}) {
  const publicChecks = [
    {
      name: 'landing',
      method: 'GET',
      path: '/',
      expectStatus: 200,
      requiredText: ['RolePatch'],
    },
    {
      name: 'jobs browser',
      method: 'GET',
      path: '/jobs',
      expectStatus: 200,
      requiredText: ['Find roles'],
    },
    {
      name: 'pricing',
      method: 'GET',
      path: '/pricing',
      expectStatus: 200,
      requiredText: ['Tokens'],
    },
    {
      name: 'proof project',
      method: 'GET',
      path: '/proof',
      expectStatus: 200,
      requiredText: ['TrueHire proof project', 'Candidate proof profile'],
    },
    {
      name: 'truehire proof preview guard',
      method: 'GET',
      path: '/api/proof/truehire-preview?handle=https%3A%2F%2Fevil.test%2Fx',
      expectStatus: 400,
      jsonKeys: ['ok', 'error'],
    },
    {
      name: 'settings readiness',
      method: 'GET',
      path: '/settings',
      expectStatus: 200,
      requiredText: ['Operational readiness', 'Chrome extension'],
    },
  ];

  const authChecks = [
    {
      name: 'apply queue api',
      method: 'GET',
      path: '/api/apply-agent/queue',
      expectStatus: 200,
      jsonKeys: ['queue'],
    },
    {
      name: 'apply packets api',
      method: 'GET',
      path: '/api/apply-agent/packets',
      expectStatus: 200,
      jsonKeys: ['packets'],
    },
    {
      name: 'apply receipts api',
      method: 'GET',
      path: '/api/apply-agent/receipts',
      expectStatus: 200,
      jsonKeys: ['receipts'],
    },
  ];

  return hasSessionCookie ? [...publicChecks, ...authChecks] : publicChecks;
}

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1]?.startsWith('--') ? 'true' : (argv[++i] ?? 'true');
    args.set(key, value);
  }
  return args;
}

async function runCheck(baseUrl, check, sessionCookie, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const started = Date.now();
  let res;
  try {
    res = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: {
        accept: check.jsonKeys ? 'application/json' : 'text/html,application/json',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return {
      name: check.name,
      path: check.path,
      status: 0,
      elapsedMs: Date.now() - started,
      ok: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
  const elapsedMs = Date.now() - started;
  const contentType = res.headers.get('content-type') ?? '';
  const body = await res.text();

  const errors = [];
  if (res.status !== check.expectStatus) {
    errors.push(`expected HTTP ${check.expectStatus}, got ${res.status}`);
  }
  for (const text of check.requiredText ?? []) {
    if (!body.includes(text)) errors.push(`missing text: ${text}`);
  }
  if (check.jsonKeys) {
    if (!contentType.includes('application/json')) {
      errors.push(`expected JSON response, got ${contentType || 'unknown content-type'}`);
    } else {
      try {
        const json = JSON.parse(body);
        for (const key of check.jsonKeys) {
          if (!(key in json)) errors.push(`missing JSON key: ${key}`);
        }
      } catch (err) {
        errors.push(`invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    name: check.name,
    path: check.path,
    status: res.status,
    elapsedMs,
    ok: errors.length === 0,
    errors,
  };
}

export async function runProductionSmoke({
  baseUrl = DEFAULT_BASE_URL,
  sessionCookie = '',
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const checks = buildSmokeChecks({ hasSessionCookie: Boolean(sessionCookie.trim()) });
    const results = [];
    for (const check of checks) {
      results.push(await runCheck(normalizedBaseUrl, check, sessionCookie, timeoutMs));
    }
    return {
      baseUrl: normalizedBaseUrl,
      authenticated: Boolean(sessionCookie.trim()),
      passed: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function printSummary(summary) {
  console.log(
    `RolePatch production smoke: ${summary.passed}/${summary.results.length} passed (${summary.baseUrl})`
  );
  if (!summary.authenticated) {
    console.log('Authenticated apply-agent checks skipped: ROLEPATCH_SESSION_COOKIE not set.');
  }
  for (const result of summary.results) {
    const marker = result.ok ? 'PASS' : 'FAIL';
    const suffix = result.errors.length > 0 ? ` — ${result.errors.join('; ')}` : '';
    console.log(`${marker} ${result.name} ${result.status} ${result.elapsedMs}ms${suffix}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl =
    args.get('base-url') ?? process.env.ROLEPATCH_SMOKE_BASE_URL ?? process.env.ROLEPATCH_BASE_URL;
  const sessionCookie = process.env.ROLEPATCH_SESSION_COOKIE ?? process.env.ROLEPATCH_COOKIE ?? '';
  const timeoutMs = Number.parseInt(process.env.ROLEPATCH_SMOKE_TIMEOUT_MS ?? '', 10);
  const summary = await runProductionSmoke({
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    sessionCookie,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  });
  printSummary(summary);
  if (summary.failed > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
