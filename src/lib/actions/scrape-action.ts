'use server';

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

interface ScrapeResult {
  title: string;
  text: string;
  html: string;
  company: string;
  role: string;
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

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
    throw new Error('Internal URLs are not allowed');
  }

  // Block private/reserved IP ranges
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (
      a === 10 ||                              // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||     // 172.16.0.0/12
      (a === 192 && b === 168) ||              // 192.168.0.0/16
      a === 127 ||                              // 127.0.0.0/8
      (a === 169 && b === 254) ||              // 169.254.0.0/16 (link-local / cloud metadata)
      a === 0                                   // 0.0.0.0/8
    ) {
      throw new Error('Internal URLs are not allowed');
    }
  }

  return parsed;
}

export async function scrapeJobUrl(url: string): Promise<ScrapeResult> {
  validateUrl(url);

  // Primary: Jina Reader
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
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

  // Fallback: linkedom + Readability
  const response = await fetch(url, {
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
  const { document } = parseHTML(html);
  const reader = new Readability(document as unknown as Document);
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

function extractCompany(url: string, title: string): string {
  const greenhouse = url.match(/boards\.greenhouse\.io\/(\w+)/);
  if (greenhouse) return greenhouse[1];

  const lever = url.match(/jobs\.lever\.co\/([^/]+)/);
  if (lever) return lever[1];

  const match = title.match(/(?:at|@)\s+(.+?)(?:\s*[-|]|$)/i);
  return match?.[1]?.trim() ?? '';
}
