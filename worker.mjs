// worker.mjs — custom Worker entry that wraps OpenNext with edge cache.
//
// The OpenNext-generated worker (`./.open-next/worker.js`) is imported as
// the inner handler. For GET / requests we consult `caches.default` first
// and only fall through to the Next handler on a miss — eliminating the
// Worker cold-start path entirely for warm-cache hits on the homepage.
//
// Cache headers are explicit so CF Edge actually treats the response as
// cacheable (s-maxage-only was getting marked DYNAMIC at the zone level;
// using caches.default sidesteps the zone-level Cache Rules requirement).
//
// All non-GET, non-`/` requests pass straight through to OpenNext.

import openNext from './.open-next/worker.js';
import { withTiming } from './timing.mjs';

// Durable Objects must be re-exported from the entry that wrangler.toml
// points at, otherwise the bindings can't resolve them at deploy time.
export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from './.open-next/worker.js';

const CACHE_PATH = '/';
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';
const INTERNAL_PATH_PREFIX = '/api/internal/';
const INTERNAL_HEADER = 'x-rolepatch-internal';
const INTERNAL_HEADER_VALUE = 'worker';
const INTERNAL_BASE_URL = 'https://rolepatch.com';
const SCHEDULED_TASKS = [
  {
    name: 'company-watchlist',
    cron: '0 * * * *',
    path: '/api/internal/cron/company-watchlist',
  },
  {
    name: 'weekly-digest',
    cron: '0 14 * * 1',
    path: '/api/internal/cron/weekly-digest',
  },
];

// Skip cache when ANY of these cookies are present — covers the better-auth
// session in both prod (__Secure-) and dev variants so signed-in users
// always see live SSR (e.g. redirect to /library).
const AUTH_COOKIE_FRAGMENTS = ['session_token', 'session-token'];

function hasAuthCookie(request) {
  const cookie = request.headers.get('cookie');
  if (!cookie) return false;
  return AUTH_COOKIE_FRAGMENTS.some((c) => cookie.includes(c));
}

function isInternalWorkerRequest(request) {
  return request.headers.get(INTERNAL_HEADER) === INTERNAL_HEADER_VALUE;
}

function internalUrl(env, path) {
  const base = env.BETTER_AUTH_URL || INTERNAL_BASE_URL;
  return new URL(path, base).toString();
}

async function runInternalPost(path, env, ctx, body) {
  const headers = new Headers({ [INTERNAL_HEADER]: INTERNAL_HEADER_VALUE });
  let requestBody;
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
    requestBody = JSON.stringify(body);
  }
  const response = await openNext.fetch(
    new Request(internalUrl(env, path), {
      method: 'POST',
      headers,
      body: requestBody,
    }),
    env,
    ctx
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[internal] POST ${path} failed ${response.status}: ${text.slice(0, 500)}`);
  }
  return response;
}

export default {
  async scheduled(event, env, ctx) {
    const tasks = SCHEDULED_TASKS.filter((task) => task.cron === event.cron);
    if (tasks.length === 0) {
      console.log(`[scheduled] no RolePatch task registered for cron=${event.cron}`);
      return;
    }
    for (const task of tasks) {
      console.log(`[scheduled] running ${task.name}`);
      await runInternalPost(task.path, env, ctx);
    }
  },

  async email(message, env, ctx) {
    try {
      const rawText = await new Response(message.raw).text();
      const response = await runInternalPost('/api/internal/email/recruiter-reply', env, ctx, {
        from: message.headers.get('from') || message.from,
        to: message.to,
        subject: message.headers.get('subject') || '(no subject)',
        raw_text: rawText,
        message_id: message.headers.get('message-id'),
        in_reply_to: message.headers.get('in-reply-to'),
      });
      if (!response.ok) {
        message.setReject('RolePatch could not ingest this recruiter reply.');
      }
    } catch (err) {
      console.error('[email] recruiter reply ingest failed', err);
      message.setReject('RolePatch could not ingest this recruiter reply.');
    }
  },

  fetch: withTiming(async function fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith(INTERNAL_PATH_PREFIX) && !isInternalWorkerRequest(request)) {
        return new Response('Not found', { status: 404 });
      }
      if (request.method !== 'GET') {
        return openNext.fetch(request, env, ctx);
      }
      if (url.pathname !== CACHE_PATH) {
        return openNext.fetch(request, env, ctx);
      }
      // Auth-bearing requests pass straight through; the user is likely
      // going to be redirected by middleware to /library or /dashboard.
      if (hasAuthCookie(request)) {
        return openNext.fetch(request, env, ctx);
      }

      // Short-circuit: the Astro landing is overlaid into
      // `.open-next/assets/index.html` by `scripts/overlay-astro-landing.mjs`.
      // For anon GET /, serve straight from the assets binding instead of
      // booting the full OpenNext stack (next-server, middleware handler,
      // Beasties pipeline, etc.). Cuts TTFB from ~250ms to ~30ms.
      //
      // The Workers Static Assets binding does NOT auto-compress its
      // responses (Lighthouse flagged ~80 KB wasted on uncompressed HTML
      // even with CF Edge cache HIT). Compress with gzip here so the
      // response — and the downstream CF Edge cache entry — is small.
      if (env.ASSETS) {
        const assetResp = await env.ASSETS.fetch(request);
        // The assets binding answers If-None-Match revalidations with 304.
        // Pass those through — falling through would serve the wrong page.
        if (assetResp.status === 304) {
          const headers = new Headers(assetResp.headers);
          headers.set('Cache-Control', CACHE_CONTROL);
          headers.set('x-edge-cache', 'ASSET');
          return new Response(null, { status: 304, headers });
        }
        if (assetResp.ok && assetResp.body) {
          const acceptEnc = request.headers.get('accept-encoding') ?? '';
          const wantsGzip = acceptEnc.includes('gzip');
          const headers = new Headers(assetResp.headers);
          headers.set('Cache-Control', CACHE_CONTROL);
          headers.set('x-edge-cache', 'ASSET');

          if (wantsGzip && !headers.has('content-encoding')) {
            headers.set('content-encoding', 'gzip');
            headers.delete('content-length');
            // `Vary: Accept-Encoding` so a future no-encoding client
            // gets a separately negotiated entry.
            const vary = headers.get('vary');
            headers.set('vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');
            return new Response(assetResp.body.pipeThrough(new CompressionStream('gzip')), {
              status: assetResp.status,
              statusText: assetResp.statusText,
              headers,
              // Body is already gzip-encoded; without this the runtime
              // gzips it a second time (encodeBody defaults to
              // "automatic") and browsers receive garbled bytes.
              encodeBody: 'manual',
            });
          }

          return new Response(assetResp.body, {
            status: assetResp.status,
            statusText: assetResp.statusText,
            headers,
          });
        }
      }

      const cache = caches.default;
      const cached = await cache.match(request);
      if (cached) {
        const hit = new Response(cached.body, cached);
        hit.headers.set('x-edge-cache', 'HIT');
        return hit;
      }

      const response = await openNext.fetch(request, env, ctx);

      // Only cache 2xx HTML responses — never error pages or redirects.
      const contentType = response.headers.get('content-type') ?? '';
      if (response.status !== 200 || !contentType.includes('text/html')) {
        return response;
      }

      // Read the body into memory once so we can hand the same bytes to
      // both the client response and the cache.put. The earlier pattern
      // (`new Response(response.body, response)` then `.clone()`) was
      // silently dropping the inlined critical-CSS chunk somewhere in the
      // stream-fork; reading once and constructing both responses from
      // the same Uint8Array sidesteps the streaming edge case entirely.
      const body = await response.arrayBuffer();
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', CACHE_CONTROL);

      const cacheable = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      ctx.waitUntil(cache.put(request, cacheable.clone()));

      const clientResponse = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      clientResponse.headers.set('x-edge-cache', 'MISS');
      return clientResponse;
    } catch (err) {
      console.error(
        `[error] ${request.method} ${new URL(request.url).pathname}:`,
        err.message,
        err.stack
      );
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }),
};
