import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};

describe('package scripts', () => {
  it('gates Cloudflare builds on deploy route verification', () => {
    const scripts = packageJson.scripts;
    const nextBuildIndex = scripts['cf:build'].indexOf('next build --webpack');
    const routeVerifierIndex = scripts['cf:build'].indexOf('node scripts/verify-deploy-routes.mjs');
    const openNextIndex = scripts['cf:build'].indexOf(
      'opennextjs-cloudflare build --skipNextBuild'
    );

    expect(scripts['verify:deploy-routes']).toBe('node scripts/verify-deploy-routes.mjs');
    expect(nextBuildIndex).toBeGreaterThanOrEqual(0);
    expect(routeVerifierIndex).toBeGreaterThan(nextBuildIndex);
    expect(openNextIndex).toBeGreaterThan(routeVerifierIndex);
    expect(scripts.deploy).toContain('pnpm cf:build');
    expect(scripts['release:verify']).toBe('node scripts/release-verify.mjs');
  });
});
