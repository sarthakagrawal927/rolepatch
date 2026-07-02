/**
 * Resume template definitions.
 *
 * Each template defines CSS that wraps the Markdown-rendered HTML body.
 * The `markdownToHtml` function in `src/lib/pdf.ts` uses the selected
 * template + runtime config (font, size, margins) to produce the final
 * standalone HTML document for PDF rendering.
 */

export type TemplateId = 'classic' | 'modern' | 'minimal';

export interface ResumeTemplate {
  id: TemplateId;
  label: string;
  description: string;
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Serif, centered name, bordered section headers',
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Sans-serif, left-aligned name, accent color headers',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean sans-serif, no borders, generous whitespace',
  },
];

export const DEFAULT_TEMPLATE: TemplateId = 'classic';

export interface ResumeRenderConfig {
  template: TemplateId;
  fontFamily: string;
  fontSize: number; // pt
  lineHeight: number;
  margin: number; // inches
}

export const DEFAULT_RENDER_CONFIG: ResumeRenderConfig = {
  template: 'classic',
  fontFamily: "'Charter', 'Georgia', 'Times New Roman', serif",
  fontSize: 10.5,
  lineHeight: 1.35,
  margin: 0.5,
};

/** Shared base CSS — reset + page setup. */
function baseCSS(cfg: ResumeRenderConfig): string {
  return `
  @page { size: letter; margin: ${cfg.margin}in; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: ${cfg.fontFamily};
    font-size: ${cfg.fontSize}pt;
    line-height: ${cfg.lineHeight};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .resume { max-width: 100%; }
  a { color: #1a5276; text-decoration: none; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  p { margin: 1px 0; }
  hr { display: none; }
  li { margin-bottom: 0; break-inside: avoid; }
  li::marker { color: #444; }
  h2 + p { margin-top: 6px; }
  p + ul { margin-top: 0; }
  ul {
    margin: 1px 0 4px;
    padding-left: 1.1em;
    list-style: disc outside;
  }
  `;
}

/** Classic template — serif, centered name, bordered section headers. */
function classicCSS(cfg: ResumeRenderConfig): string {
  return `
  ${baseCSS(cfg)}
  h1 {
    font-size: 22pt;
    font-weight: 700;
    margin: 0 0 2px;
    text-align: center;
    letter-spacing: 0.01em;
  }
  h1 + p {
    text-align: center;
    font-size: 9pt;
    color: #444;
    margin: 0 0 6px;
  }
  h2 {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 10px 0 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid #333;
    break-after: avoid;
  }
  h3 {
    font-size: ${cfg.fontSize}pt;
    font-weight: 700;
    margin: 6px 0 1px;
    break-after: avoid;
  }
  `;
}

/** Modern template — sans-serif, left-aligned name, accent color headers. */
function modernCSS(cfg: ResumeRenderConfig): string {
  return `
  ${baseCSS(cfg)}
  h1 {
    font-size: 24pt;
    font-weight: 800;
    margin: 0 0 2px;
    text-align: left;
    letter-spacing: -0.01em;
    color: #1a1a1a;
  }
  h1 + p {
    text-align: left;
    font-size: 9pt;
    color: #555;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 12px 0 4px;
    padding-bottom: 3px;
    border-bottom: 2px solid #2563eb;
    color: #2563eb;
    break-after: avoid;
  }
  h3 {
    font-size: ${cfg.fontSize}pt;
    font-weight: 700;
    margin: 6px 0 1px;
    break-after: avoid;
  }
  a { color: #2563eb; }
  li::marker { color: #2563eb; }
  `;
}

/** Minimal template — clean sans-serif, no borders, generous whitespace. */
function minimalCSS(cfg: ResumeRenderConfig): string {
  return `
  ${baseCSS(cfg)}
  h1 {
    font-size: 21pt;
    font-weight: 600;
    margin: 0 0 4px;
    text-align: left;
    letter-spacing: 0;
  }
  h1 + p {
    text-align: left;
    font-size: 9pt;
    color: #666;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 10.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin: 14px 0 3px;
    border-bottom: none;
    color: #333;
    break-after: avoid;
  }
  h3 {
    font-size: ${cfg.fontSize}pt;
    font-weight: 600;
    margin: 8px 0 1px;
    break-after: avoid;
  }
  ul {
    margin: 2px 0 6px;
    list-style: none;
    padding-left: 0.8em;
  }
  li::marker { content: '·  '; color: #999; }
  `;
}

const TEMPLATE_CSS: Record<TemplateId, (cfg: ResumeRenderConfig) => string> = {
  classic: classicCSS,
  modern: modernCSS,
  minimal: minimalCSS,
};

/**
 * Generate the full CSS for a given template + config.
 */
export function templateCSS(cfg: ResumeRenderConfig): string {
  const generator = TEMPLATE_CSS[cfg.template] ?? TEMPLATE_CSS[DEFAULT_TEMPLATE];
  return generator(cfg);
}

/**
 * Parse a TemplateId from a string, falling back to default.
 */
export function parseTemplateId(value: string | null | undefined): TemplateId {
  if (value === 'modern' || value === 'minimal' || value === 'classic') return value;
  return DEFAULT_TEMPLATE;
}
