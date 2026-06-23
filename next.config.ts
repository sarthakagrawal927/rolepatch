import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval required by Next.js dev + some libs.
      // static.cloudflareinsights.com is the Cloudflare Web Analytics beacon
      // that Cloudflare injects automatically on the rolepatch.com zone.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://us-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      // https: is broad but already in use for AI/scraping/saas-maker traffic;
      // explicit cloudflareinsights.com keeps the beacon working if the policy is tightened later.
      "connect-src 'self' https: https://cloudflareinsights.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Emit .next/standalone so Beasties' post-build inline-critical-css.mjs
  // can modify the same HTML that OpenNext's --skipNextBuild consumes.
  output: 'standalone',
  images: { unoptimized: true },
  serverExternalPackages: [
    '@libsql/client',
    '@sparticuz/chromium',
    'puppeteer-core',
    '@mozilla/readability',
    'mammoth',
    'pdf-parse',
  ],
  outputFileTracingExcludes: {
    '*': [
      '@sparticuz/chromium/**',
      'puppeteer-core/**',
      '@puppeteer/**',
      'mammoth/**',
      '@mozilla/readability/**',
      'pdf-parse/**',
    ],
  },
  async headers() {
    return [
      {
        source: '/',
        headers: [
          ...securityHeaders,
          {
            // CF Edge needs both max-age and CDN-Cache-Control to actually
            // cache HTML at edge; s-maxage alone was being marked DYNAMIC.
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/tools/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/blog/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
