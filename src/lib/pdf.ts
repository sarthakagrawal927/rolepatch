import { marked } from 'marked';

import {
  DEFAULT_RENDER_CONFIG,
  type ResumeRenderConfig,
  parseTemplateId,
  templateCSS,
} from '@/lib/resume-templates';

/**
 * Render a Markdown resume string to a full standalone HTML document
 * suitable for PDF conversion. Uses the selected template + config for
 * fonts, sizes, margins, and visual style.
 */
export function markdownToHtml(
  markdown: string,
  title = 'Resume',
  config?: Partial<ResumeRenderConfig>
): string {
  const cfg: ResumeRenderConfig = {
    ...DEFAULT_RENDER_CONFIG,
    ...config,
    template: parseTemplateId(config?.template),
  };
  const body = marked.parse(markdown, { async: false, gfm: true }) as string;
  const css = templateCSS(cfg);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body>
<div class="resume">
${body}
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render HTML to PDF bytes.
 *
 * Priority:
 *  1. Cloudflare Browser Rendering binding (`env.BROWSER`) — used in production
 *     on Workers. Cheap, fast, no Chromium binaries in the bundle.
 *  2. Local puppeteer-core + @sparticuz/chromium fallback — used during Node
 *     dev / Vercel-style runtime when no binding is present.
 *
 * The puppeteer imports are loaded via `Function(...)` so they stay invisible
 * to the OpenNext / Workers bundler.
 */
export async function renderPdf(html: string): Promise<Uint8Array> {
  // 1. Cloudflare Browser Rendering binding path (production Workers).
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext({ async: false });
    const browserBinding = (
      ctx?.env as unknown as
        | { BROWSER?: { fetch: (req: Request) => Promise<Response> } }
        | undefined
    )?.BROWSER;

    if (browserBinding) {
      const puppeteerMod = await import('@cloudflare/puppeteer');
      // @ts-expect-error — runtime types for @cloudflare/puppeteer.launch(binding)
      const browser = await puppeteerMod.launch(browserBinding);
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = (await page.pdf({
          format: 'letter',
          printBackground: true,
          margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
          preferCSSPageSize: true,
        })) as Uint8Array;
        return pdf;
      } finally {
        await browser.close();
      }
    }
  } catch {
    // Fall through to Node puppeteer-core path.
  }

  // 2. Node puppeteer-core fallback (Vercel / local dev).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dynImport: (m: string) => Promise<any> = new Function('m', 'return import(m)') as (
    m: string
  ) => Promise<unknown> as (m: string) => Promise<unknown> as (
    m: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => Promise<any>;

  const [chromiumMod, puppeteerMod] = await Promise.all([
    dynImport('@sparticuz/chromium'),
    dynImport('puppeteer-core'),
  ]);

  const chromium = chromiumMod.default ?? chromiumMod;
  const puppeteer = puppeteerMod.default ?? puppeteerMod;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
      preferCSSPageSize: true,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
