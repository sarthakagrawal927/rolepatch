import { describe, expect, it, vi } from 'vitest';

import {
  buildSmokeChecks,
  normalizeBaseUrl,
  runProductionSmoke,
} from '../scripts/production-smoke.mjs';

describe('production smoke harness', () => {
  it('normalizes base URLs and keeps auth checks opt-in', () => {
    expect(normalizeBaseUrl('https://rolepatch.com/')).toBe('https://rolepatch.com');
    expect(buildSmokeChecks({ hasSessionCookie: false }).map((check) => check.name)).toEqual([
      'landing',
      'jobs browser',
      'pricing',
      'proof project',
      'truehire proof preview guard',
      'settings readiness',
    ]);
    expect(buildSmokeChecks({ hasSessionCookie: true }).map((check) => check.name)).toContain(
      'apply queue api'
    );
  });

  it('runs public smoke checks without a session cookie', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/jobs')) return new Response('<h1>Find roles</h1>');
      if (url.endsWith('/pricing')) return new Response('<h1>Tokens</h1>');
      if (url.endsWith('/proof')) {
        return new Response('<h1>TrueHire proof project</h1><h2>Candidate proof profile</h2>');
      }
      if (url.includes('/api/proof/truehire-preview')) {
        return Response.json(
          { ok: false, error: 'Enter a TrueHire handle or profile URL.' },
          { status: 400 }
        );
      }
      if (url.endsWith('/settings')) {
        return new Response('<h1>Operational readiness</h1><h2>Chrome extension</h2>');
      }
      return new Response('<h1>RolePatch</h1>');
    });

    const summary = await runProductionSmoke({
      baseUrl: 'https://rolepatch.com/',
      fetchImpl,
    });

    expect(summary.authenticated).toBe(false);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(6);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('/api/apply-agent'))).toBe(
      false
    );
  });

  it('runs authenticated apply-agent read checks when a session cookie is supplied', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/api/apply-agent/queue')) {
        return Response.json({ queue: [] });
      }
      if (url.endsWith('/api/apply-agent/packets')) {
        return Response.json({ packets: [] });
      }
      if (url.endsWith('/api/apply-agent/receipts')) {
        return Response.json({ receipts: [] });
      }
      if (url.endsWith('/jobs')) return new Response('<h1>Find roles</h1>');
      if (url.endsWith('/pricing')) return new Response('<h1>Tokens</h1>');
      if (url.endsWith('/proof')) {
        return new Response('<h1>TrueHire proof project</h1><h2>Candidate proof profile</h2>');
      }
      if (url.includes('/api/proof/truehire-preview')) {
        return Response.json(
          { ok: false, error: 'Enter a TrueHire handle or profile URL.' },
          { status: 400 }
        );
      }
      if (url.endsWith('/settings')) {
        return new Response('<h1>Operational readiness</h1><h2>Chrome extension</h2>');
      }
      return new Response('<h1>RolePatch</h1>');
    });

    const summary = await runProductionSmoke({
      baseUrl: 'https://rolepatch.com',
      sessionCookie: 'better-auth.session_token=abc',
      fetchImpl,
    });

    expect(summary.authenticated).toBe(true);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(9);
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        'https://rolepatch.com/api/apply-agent/queue',
        'https://rolepatch.com/api/apply-agent/packets',
        'https://rolepatch.com/api/apply-agent/receipts',
      ])
    );
  });

  it('reports fetch failures as failed smoke checks', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connection refused');
    });

    const summary = await runProductionSmoke({
      baseUrl: 'https://rolepatch.com',
      fetchImpl,
      timeoutMs: 1,
    });

    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(6);
    expect(summary.results[0]).toMatchObject({
      ok: false,
      status: 0,
      errors: ['connection refused'],
    });
  });
});
