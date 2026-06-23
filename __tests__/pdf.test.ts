import { describe, expect, it } from 'vitest';

import { markdownToHtml } from '@/lib/pdf';

describe('markdownToHtml', () => {
  const sample = `# Jane Doe

jane@example.com | (555) 555-5555

---

## Experience

**Senior Engineer** — _Acme Corp_ | 2021 – Present

- Shipped a thing
- Shipped another thing

## Skills

**Languages:** TypeScript, Python
`;

  it('produces a full standalone HTML document with doctype and title', () => {
    const html = markdownToHtml(sample, 'Jane Doe');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html');
    expect(html).toContain('<title>Jane Doe</title>');
    expect(html).toContain('</html>');
  });

  it('escapes HTML in the document title', () => {
    const html = markdownToHtml('# hi', '<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('transforms Markdown headings to h1/h2', () => {
    const html = markdownToHtml(sample);
    expect(html).toMatch(/<h1[^>]*>\s*Jane Doe\s*<\/h1>/);
    expect(html).toMatch(/<h2[^>]*>\s*Experience\s*<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>\s*Skills\s*<\/h2>/);
  });

  it('renders bullets as <ul><li>', () => {
    const html = markdownToHtml(sample);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Shipped a thing</li>');
    expect(html).toContain('<li>Shipped another thing</li>');
  });

  it('renders bold/italic runs as <strong>/<em>', () => {
    const html = markdownToHtml(sample);
    expect(html).toContain('<strong>Senior Engineer</strong>');
    expect(html).toContain('<em>Acme Corp</em>');
  });

  it('includes print-ready @page letter size and 1in margins', () => {
    const html = markdownToHtml(sample);
    expect(html).toMatch(/@page\s*{\s*size:\s*letter/);
    expect(html).toMatch(/margin:\s*1in/);
  });

  it('uses a serif body font at 10.5pt', () => {
    const html = markdownToHtml(sample);
    expect(html).toContain('Georgia');
    expect(html).toContain('10.5pt');
  });
});
