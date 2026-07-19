import { DEFAULT_EMAIL_FROM, isEmailConfigured } from '@/lib/email';

export type OperationalReadinessStatus = 'ready' | 'needs_setup' | 'code_ready';

interface OperationalReadinessItem {
  id: string;
  label: string;
  status: OperationalReadinessStatus;
  detail: string;
  nextStep?: string;
}

export interface OperationalReadiness {
  generatedAt: number;
  items: OperationalReadinessItem[];
}

type EnvSnapshot = Record<string, string | undefined>;

interface OperationalReadinessInput {
  browserBindingDetected?: boolean;
  knowledgebaseBindingDetected?: boolean;
  env?: EnvSnapshot;
  now?: number;
}

function configured(env: EnvSnapshot, name: string): boolean {
  return Boolean(env[name]?.trim());
}

async function hasBrowserBinding(): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext({ async: false });
    return Boolean((ctx?.env as { BROWSER?: unknown } | undefined)?.BROWSER);
  } catch {
    return false;
  }
}

async function hasKnowledgebaseBinding(): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext({ async: false });
    return Boolean((ctx?.env as { RAG_SERVICE?: unknown } | undefined)?.RAG_SERVICE);
  } catch {
    return false;
  }
}

export async function getOperationalReadiness(
  input: OperationalReadinessInput = {}
): Promise<OperationalReadiness> {
  const env = input.env ?? process.env;
  const browserBindingDetected = input.browserBindingDetected ?? (await hasBrowserBinding());
  const knowledgebaseBindingDetected =
    input.knowledgebaseBindingDetected ?? (await hasKnowledgebaseBinding());
  const emailConfigured = input.env ? configured(env, 'RESEND_API_KEY') : isEmailConfigured();
  const authReady = [
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ].every((name) => configured(env, name));
  const aiGatewayReady =
    configured(env, 'AI_BASE_URL') &&
    (configured(env, 'AI_API_KEY') || configured(env, 'AI_GATEWAY_API_KEY'));
  const knowledgebaseReady =
    configured(env, 'RAG_SERVICE_KEY') && configured(env, 'ROLEPATCH_RAG_INDEX_ID');
  const dodoCheckoutReady =
    configured(env, 'DODO_PAYMENTS_API_KEY') &&
    configured(env, 'DODO_PAYMENTS_RETURN_URL') &&
    configured(env, 'DODO_PRODUCT_STARTER') &&
    configured(env, 'DODO_PRODUCT_PRO') &&
    configured(env, 'DODO_PRODUCT_BULK');
  const dodoWebhookReady =
    configured(env, 'DODO_PAYMENTS_WEBHOOK_KEY') &&
    configured(env, 'DODO_PRODUCT_STARTER') &&
    configured(env, 'DODO_PRODUCT_PRO') &&
    configured(env, 'DODO_PRODUCT_BULK');

  return {
    generatedAt: input.now ?? Date.now(),
    items: [
      {
        id: 'browser-rendering',
        label: 'Browser Rendering',
        status: browserBindingDetected ? 'ready' : 'needs_setup',
        detail: browserBindingDetected
          ? 'BROWSER binding detected for PDF export and reviewed browser checks.'
          : 'BROWSER binding is not visible in this runtime, so browser checks fall back to HTML inspection.',
        nextStep: browserBindingDetected
          ? undefined
          : 'Provision the Cloudflare Browser Rendering binding before relying on production browser runs.',
      },
      {
        id: 'outbound-email',
        label: 'Outbound email',
        status: emailConfigured ? 'ready' : 'needs_setup',
        detail: emailConfigured
          ? 'Resend sending is configured for recruiter replies and weekly digests.'
          : 'RESEND_API_KEY is not configured; email sends fail closed and are skipped.',
        nextStep: emailConfigured
          ? undefined
          : 'Set the Resend secret in the Worker environment when production sending is ready.',
      },
      {
        id: 'email-from',
        label: 'Sender identity',
        status: configured(env, 'EMAIL_FROM') ? 'ready' : 'code_ready',
        detail: configured(env, 'EMAIL_FROM')
          ? 'EMAIL_FROM is configured for outbound messages.'
          : `Using the default sender ${DEFAULT_EMAIL_FROM}.`,
        nextStep: configured(env, 'EMAIL_FROM')
          ? undefined
          : 'Override EMAIL_FROM if sender verification uses a different production identity.',
      },
      {
        id: 'ai-gateway',
        label: 'AI gateway',
        status: aiGatewayReady ? 'ready' : 'needs_setup',
        detail: aiGatewayReady
          ? 'AI base URL and API key are configured.'
          : 'AI_BASE_URL plus an AI API key are required for tailoring, fit scoring, and drafts.',
        nextStep: aiGatewayReady
          ? undefined
          : 'Configure AI_BASE_URL and AI_API_KEY or AI_GATEWAY_API_KEY for the target runtime.',
      },
      {
        id: 'knowledgebase-similarity',
        label: 'Knowledgebase similarity',
        status: knowledgebaseReady ? 'ready' : 'needs_setup',
        detail: knowledgebaseReady
          ? knowledgebaseBindingDetected
            ? 'Knowledgebase RAG service binding is configured for semantic job-to-resume ranking.'
            : 'Knowledgebase semantic ranking is configured and will use the HTTPS service fallback.'
          : 'Semantic pre-ranking needs the shared Knowledgebase service key and a RolePatch RAG index.',
        nextStep: knowledgebaseReady
          ? undefined
          : 'Configure RAG_SERVICE_KEY and ROLEPATCH_RAG_INDEX_ID, then add the RAG_SERVICE binding when production config changes are approved.',
      },
      {
        id: 'auth-oauth',
        label: 'Auth and OAuth',
        status: authReady ? 'ready' : 'needs_setup',
        detail: authReady
          ? 'Better Auth and Google OAuth configuration is present.'
          : 'Better Auth URL/secret and Google OAuth credentials are not all configured in this runtime.',
        nextStep: authReady
          ? undefined
          : 'Configure BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, and GOOGLE_CLIENT_SECRET.',
      },
      {
        id: 'payment-checkout',
        label: 'Payment checkout',
        status: dodoCheckoutReady ? 'ready' : 'needs_setup',
        detail: dodoCheckoutReady
          ? 'Dodo checkout API, return URL, and token product IDs are configured.'
          : 'Dodo checkout needs an API key, return URL, and starter/pro/bulk product IDs.',
        nextStep: dodoCheckoutReady
          ? undefined
          : 'Configure DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_RETURN_URL, and all DODO_PRODUCT_* IDs.',
      },
      {
        id: 'payment-webhook',
        label: 'Payment webhook',
        status: dodoWebhookReady ? 'ready' : 'needs_setup',
        detail: dodoWebhookReady
          ? 'Dodo webhook verification and token product mapping are configured.'
          : 'Dodo webhook verification needs the webhook secret and token product IDs.',
        nextStep: dodoWebhookReady
          ? undefined
          : 'Configure DODO_PAYMENTS_WEBHOOK_KEY and all DODO_PRODUCT_* IDs before accepting live payments.',
      },
      {
        id: 'worker-hooks',
        label: 'Worker hooks',
        status: 'code_ready',
        detail:
          'Scheduled and Email Routing handlers are wired in worker.mjs and dispatch through internal routes.',
        nextStep:
          'Activate production cron triggers and the Email Routing rule in Cloudflare when ready.',
      },
    ],
  };
}
