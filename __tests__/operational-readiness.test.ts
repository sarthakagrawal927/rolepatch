import { describe, expect, it } from 'vitest';

import { getOperationalReadiness } from '@/lib/operational-readiness';

describe('operational readiness', () => {
  it('marks Cloudflare browser and email dependencies ready when configured', async () => {
    const readiness = await getOperationalReadiness({
      browserBindingDetected: true,
      knowledgebaseBindingDetected: true,
      now: 123,
      env: {
        RESEND_API_KEY: 'resend-secret',
        EMAIL_FROM: 'RolePatch <alerts@example.com>',
        AI_BASE_URL: 'https://gateway.example.com/v1',
        AI_API_KEY: 'ai-secret',
        RAG_SERVICE_KEY: 'rag-secret',
        ROLEPATCH_RAG_INDEX_ID: 'rolepatch-index',
        BETTER_AUTH_SECRET: 'auth-secret',
        BETTER_AUTH_URL: 'https://rolepatch.com',
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        DODO_PAYMENTS_API_KEY: 'dodo-api-secret',
        DODO_PAYMENTS_WEBHOOK_KEY: 'dodo-webhook-secret',
        DODO_PAYMENTS_RETURN_URL: 'https://rolepatch.com/pricing',
        DODO_PRODUCT_STARTER: 'prod-starter',
        DODO_PRODUCT_PRO: 'prod-pro',
        DODO_PRODUCT_BULK: 'prod-bulk',
      },
    });

    expect(readiness.generatedAt).toBe(123);
    expect(readiness.items.find((item) => item.id === 'browser-rendering')?.status).toBe('ready');
    expect(readiness.items.find((item) => item.id === 'outbound-email')?.status).toBe('ready');
    expect(readiness.items.find((item) => item.id === 'ai-gateway')?.status).toBe('ready');
    expect(readiness.items.find((item) => item.id === 'knowledgebase-similarity')?.status).toBe(
      'ready'
    );
    expect(readiness.items.find((item) => item.id === 'knowledgebase-similarity')?.detail).toMatch(
      /service binding is configured/i
    );
    expect(readiness.items.find((item) => item.id === 'auth-oauth')?.status).toBe('ready');
    expect(readiness.items.find((item) => item.id === 'payment-checkout')?.status).toBe('ready');
    expect(readiness.items.find((item) => item.id === 'payment-webhook')?.status).toBe('ready');
  });

  it('reports safe setup gaps without leaking configured secret values', async () => {
    const readiness = await getOperationalReadiness({
      browserBindingDetected: false,
      env: {
        RESEND_API_KEY: 'resend-secret',
        AI_BASE_URL: 'https://gateway.example.com/v1',
        AI_GATEWAY_API_KEY: 'gateway-secret',
        BETTER_AUTH_SECRET: 'auth-secret',
        DODO_PAYMENTS_API_KEY: 'dodo-api-secret',
        DODO_PAYMENTS_WEBHOOK_KEY: 'dodo-webhook-secret',
        DODO_PRODUCT_STARTER: 'prod-starter',
      },
    });

    expect(readiness.items.find((item) => item.id === 'browser-rendering')?.status).toBe(
      'needs_setup'
    );
    expect(readiness.items.find((item) => item.id === 'email-from')?.status).toBe('code_ready');
    expect(readiness.items.find((item) => item.id === 'auth-oauth')?.status).toBe('needs_setup');
    expect(readiness.items.find((item) => item.id === 'knowledgebase-similarity')?.status).toBe(
      'needs_setup'
    );
    expect(readiness.items.find((item) => item.id === 'payment-checkout')?.status).toBe(
      'needs_setup'
    );
    expect(readiness.items.find((item) => item.id === 'payment-webhook')?.status).toBe(
      'needs_setup'
    );

    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain('resend-secret');
    expect(serialized).not.toContain('gateway-secret');
    expect(serialized).not.toContain('rag-secret');
    expect(serialized).not.toContain('auth-secret');
    expect(serialized).not.toContain('dodo-api-secret');
    expect(serialized).not.toContain('dodo-webhook-secret');
    expect(serialized).not.toContain('prod-starter');
  });

  it('marks Knowledgebase ready with HTTPS fallback when only key and index are configured', async () => {
    const readiness = await getOperationalReadiness({
      browserBindingDetected: true,
      knowledgebaseBindingDetected: false,
      env: {
        RAG_SERVICE_KEY: 'rag-secret',
        ROLEPATCH_RAG_INDEX_ID: 'rolepatch-index',
      },
    });

    const item = readiness.items.find((entry) => entry.id === 'knowledgebase-similarity');
    expect(item?.status).toBe('ready');
    expect(item?.detail).toMatch(/HTTPS service fallback/i);
  });
});
