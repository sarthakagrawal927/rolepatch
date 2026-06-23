'use server';

const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;

interface ScrapeResult {
  title: string;
  text: string;
  html: string;
  company: string;
  role: string;
}

/**
 * Typed result for scraping. Lets the UI distinguish a real failure (and show
 * a "couldn't read that posting — paste it manually" fallback) from success,
 * instead of a thrown error or a blank screen.
 */
export type ScrapeOutcome =
  | { ok: true; data: ScrapeResult }
  | { ok: false; reason: 'invalid_url' | 'unreadable' | 'network'; message: string };

const MAX_SCRAPE_ATTEMPTS = 3;

function isRetryableStatus(status: number): boolean {
  // 429 + 5xx are worth retrying; 4xx (other than 429) are not.
  return status === 429 || status >= 500;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with exponential backoff. Retries on network errors and retryable
 * HTTP statuses; returns the last response otherwise.
 */
async function fetchWithRetry(
  input: string,
  init: RequestInit,
  attempts = MAX_SCRAPE_ATTEMPTS
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      // 400ms, 800ms, 1600ms ... with light jitter.
      await delay(400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200));
    }
    try {
      const res = await fetch(input, init);
      if (res.ok || !isRetryableStatus(res.status) || attempt === attempts - 1) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('Request failed after retries');
}

function validateUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Block localhost variants (IPv4 + IPv6 loopback + unspecified)
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '::' ||
    hostname === '0.0.0.0'
  ) {
    throw new Error('Internal URLs are not allowed');
  }

  // Block private/reserved IP ranges
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      a === 127 || // 127.0.0.0/8
      (a === 169 && b === 254) || // 169.254.0.0/16 (link-local / cloud metadata)
      a === 0 // 0.0.0.0/8
    ) {
      throw new Error('Internal URLs are not allowed');
    }
  }

  return parsed;
}

export async function scrapeJobUrl(url: string): Promise<ScrapeResult> {
  validateUrl(url);

  // Primary: Jina Reader (with backoff retry on transient failures).
  try {
    const res = await fetchWithRetry(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/markdown' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const text = await res.text();
      const title = text.split('\n')[0]?.replace(/^#+\s*/, '') ?? '';
      return {
        title,
        text,
        html: '',
        company: extractCompany(url, title),
        role: title,
      };
    }
  } catch {
    // fallback below
  }

  // Fallback: direct fetch + linkedom + Readability (also retried).
  const response = await fetchWithRetry(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  const html = await response.text();
  const [linkedomMod, readabilityMod] = await Promise.all([
    dynImport('linkedom') as Promise<{ parseHTML: (h: string) => { document: unknown } }>,
    dynImport('@mozilla/readability') as Promise<{
      Readability: new (
        d: unknown
      ) => { parse(): { title?: string; textContent?: string; content?: string } | null };
    }>,
  ]);
  const { document } = linkedomMod.parseHTML(html);
  const reader = new readabilityMod.Readability(document);
  const article = reader.parse();

  if (!article) throw new Error('Failed to parse job page content');

  return {
    title: article.title ?? '',
    text: article.textContent ?? '',
    html: article.content ?? '',
    company: extractCompany(url, article.title ?? ''),
    role: article.title ?? '',
  };
}

/**
 * Non-throwing variant of {@link scrapeJobUrl}. Returns a typed
 * {@link ScrapeOutcome} so the UI can fall back to manual paste instead of
 * showing a blank screen or a raw error string.
 */
export async function scrapeJobUrlSafe(url: string): Promise<ScrapeOutcome> {
  try {
    validateUrl(url);
  } catch (err) {
    return {
      ok: false,
      reason: 'invalid_url',
      message: err instanceof Error ? err.message : 'That URL looks invalid.',
    };
  }

  try {
    const data = await scrapeJobUrl(url);
    if (!data.text.trim()) {
      return {
        ok: false,
        reason: 'unreadable',
        message:
          "We couldn't read that posting. Paste the job description text manually to continue.",
      };
    }
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // A failed parse means the page loaded but had no readable content.
    const reason = message.includes('parse') ? 'unreadable' : 'network';
    return {
      ok: false,
      reason,
      message:
        "We couldn't read that posting. Paste the job description text manually to continue.",
    };
  }
}

function extractCompany(url: string, title: string): string {
  const greenhouse = url.match(/boards\.greenhouse\.io\/(\w+)/);
  if (greenhouse) return greenhouse[1];

  const lever = url.match(/jobs\.lever\.co\/([^/]+)/);
  if (lever) return lever[1];

  const match = title.match(/(?:at|@)\s+(.+?)(?:\s*[-|]|$)/i);
  return match?.[1]?.trim() ?? '';
}
