import { describe, expect, it } from 'vitest';

import {
  manifestKeyForRoute,
  REQUIRED_DEPLOY_ROUTES,
  verifyDeployRoutes,
} from '../scripts/verify-deploy-routes.mjs';

describe('deploy route verifier', () => {
  it('maps app routes to Next app-path manifest keys', () => {
    expect(manifestKeyForRoute('/')).toBe('/page');
    expect(manifestKeyForRoute('/jobs')).toBe('/jobs/page');
    expect(manifestKeyForRoute('/proof')).toBe('/proof/page');
    expect(manifestKeyForRoute('/settings')).toBe('/settings/page');
    expect(manifestKeyForRoute('/api/apply-agent/queue')).toBe('/api/apply-agent/queue/route');
    expect(manifestKeyForRoute('/api/proof/truehire-preview')).toBe(
      '/api/proof/truehire-preview/route'
    );
    expect(manifestKeyForRoute('/api/proof/truehire-role-fit')).toBe(
      '/api/proof/truehire-role-fit/route'
    );
  });

  it('passes when all required deploy routes exist', () => {
    const manifest = Object.fromEntries(
      REQUIRED_DEPLOY_ROUTES.map((route) => [manifestKeyForRoute(route), `app${route}.js`])
    );

    const verification = verifyDeployRoutes(manifest);

    expect(verification.ok).toBe(true);
    expect(verification.missing).toHaveLength(0);
    expect(verification.present.map((result) => result.route)).toEqual(REQUIRED_DEPLOY_ROUTES);
  });

  it('reports missing critical parity routes', () => {
    const manifest = {
      '/page': 'app/page.js',
      '/pricing/page': 'app/pricing/page.js',
    };

    const verification = verifyDeployRoutes(manifest, ['/', '/jobs', '/pricing', '/settings']);

    expect(verification.ok).toBe(false);
    expect(verification.missing.map((result) => result.route)).toEqual(['/jobs', '/settings']);
  });
});
