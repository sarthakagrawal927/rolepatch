#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const DEFAULT_PORT = 3011;
const SERVER_READY_TIMEOUT_MS = 20_000;
export const BUILT_SERVER_COMMAND = [process.execPath, ['.next/standalone/server.js']];
export const STANDALONE_ASSET_COPIES = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
];

export const RELEASE_VERIFY_STEPS = [
  ['pnpm', ['typecheck']],
  ['pnpm', ['lint']],
  ['pnpm', ['test']],
  ['pnpm', ['--dir', 'extension', 'build']],
  ['pnpm', ['cf:build']],
];

export const FOCUSED_E2E_ARGS = [
  'exec',
  'playwright',
  'test',
  'e2e/ats-job-flow.spec.ts',
  'e2e/settings-readiness.spec.ts',
  '--workers=1',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
}

async function waitForServer(url) {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < SERVER_READY_TIMEOUT_MS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function withBuiltServer(fn) {
  const port = Number.parseInt(process.env.ROLEPATCH_RELEASE_VERIFY_PORT ?? '', 10) || DEFAULT_PORT;
  const baseUrl = `http://localhost:${port}`;
  for (const [source, destination] of STANDALONE_ASSET_COPIES) {
    if (!existsSync(source)) continue;
    rmSync(destination, { recursive: true, force: true });
    cpSync(source, destination, { recursive: true });
  }
  const [command, args] = BUILT_SERVER_COMMAND;
  const server = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? 'rolepatch-local-release-verify-secret-32',
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? baseUrl,
    },
    stdio: 'inherit',
  });

  try {
    await waitForServer(baseUrl);
    await fn(baseUrl);
  } finally {
    server.kill('SIGTERM');
  }
}

export async function main() {
  for (const [command, args] of RELEASE_VERIFY_STEPS) {
    run(command, args);
  }

  await withBuiltServer(async (baseUrl) => {
    run('pnpm', ['smoke:prod'], {
      env: {
        ROLEPATCH_SMOKE_BASE_URL: baseUrl,
      },
    });
    run('pnpm', FOCUSED_E2E_ARGS, {
      env: {
        PLAYWRIGHT_BASE_URL: baseUrl,
        PLAYWRIGHT_WEB_SERVER_COMMAND: `pnpm exec next start -p ${new URL(baseUrl).port}`,
      },
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
