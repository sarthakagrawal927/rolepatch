#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const REQUIRED_DEPLOY_ROUTES = [
  '/',
  '/jobs',
  '/proof',
  '/pricing',
  '/settings',
  '/dashboard',
  '/api/jobs/search',
  '/api/apply-agent/queue',
  '/api/apply-agent/packets',
  '/api/apply-agent/receipts',
  '/api/extension/apply-packet',
  '/api/proof/truehire-preview',
  '/api/proof/truehire-role-fit',
  '/api/internal/cron/weekly-digest',
];

export function manifestKeyForRoute(route) {
  if (route === '/') return '/page';
  if (route.startsWith('/api/')) return `${route}/route`;
  return `${route}/page`;
}

export function verifyDeployRoutes(manifest, routes = REQUIRED_DEPLOY_ROUTES) {
  const keys = new Set(Object.keys(manifest ?? {}));
  const results = routes.map((route) => {
    const manifestKey = manifestKeyForRoute(route);
    return {
      route,
      manifestKey,
      ok: keys.has(manifestKey),
    };
  });
  return {
    ok: results.every((result) => result.ok),
    present: results.filter((result) => result.ok),
    missing: results.filter((result) => !result.ok),
    results,
  };
}

export async function loadAppPathsManifest(manifestPath = '.next/server/app-paths-manifest.json') {
  const absolutePath = join(process.cwd(), manifestPath);
  const raw = await readFile(absolutePath, 'utf8');
  return JSON.parse(raw);
}

function printVerification(verification) {
  console.log(
    `RolePatch deploy route verification: ${verification.present.length}/${verification.results.length} present`
  );
  for (const result of verification.results) {
    const marker = result.ok ? 'PASS' : 'FAIL';
    console.log(`${marker} ${result.route} (${result.manifestKey})`);
  }
}

async function main() {
  const manifest = await loadAppPathsManifest();
  const verification = verifyDeployRoutes(manifest);
  printVerification(verification);
  if (!verification.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Deploy route verification failed: ${message}`);
    console.error('Run `pnpm build` before verifying deploy routes.');
    process.exitCode = 1;
  });
}
