/**
 * Portable agent-edge handler (fleet GEO standard).
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 */

export const AGENT_SURFACE = {
  name: 'RolePatch',
  url: 'https://rolepatch.com',
  llmsTxt:
    '# RolePatch\n' +
    '\n' +
    '> AI-powered resume tailoring. Score fit against a job description, rewrite bullets for the role, and prep interviews.\n' +
    '\n' +
    '## Product\n' +
    '\n' +
    '- [Home](https://rolepatch.com/): Product landing\n' +
    '- [Pricing](https://rolepatch.com/pricing): Plans and limits\n' +
    '- [Tools](https://rolepatch.com/tools): Public tools\n' +
    '\n' +
    '## Machine surfaces\n' +
    '\n' +
    '- [Agent catalog](https://rolepatch.com/api/ai): JSON inventory of public surfaces\n' +
    '- [Homepage markdown](https://rolepatch.com/index.md): Product brief without JS\n' +
    '- [This index](https://rolepatch.com/llms.txt)\n' +
    '\n' +
    '## Optional\n' +
    '\n' +
    '- [Foundry](https://sassmaker.com): Parent fleet showcase\n',
  indexMd:
    '# RolePatch\n' +
    '\n' +
    'AI-powered resume tailoring and job-application assistant.\n' +
    '\n' +
    '## What it is\n' +
    '\n' +
    '- Score resume fit against a job description\n' +
    '- Rewrite bullets for the role\n' +
    '- Cover letters, company research, STAR prep\n' +
    '\n' +
    "## Who it's for\n" +
    '\n' +
    'Job seekers who want reviewed, role-specific application materials — not generic AI fluff.\n' +
    '\n' +
    '## Agent entrypoints\n' +
    '\n' +
    '- https://rolepatch.com/llms.txt\n' +
    '- https://rolepatch.com/api/ai\n' +
    '- https://rolepatch.com/index.md\n' +
    '\n' +
    'Dashboard routes require auth and are not agent-indexed.\n',
  catalog: {
    name: 'RolePatch',
    version: '1',
    url: 'https://rolepatch.com',
    llms: 'https://rolepatch.com/llms.txt',
    llmsFull: null,
    sitemap: 'https://rolepatch.com/sitemap.xml',
    markdown: {
      suffix: '.md',
      negotiation: true,
    },
    surfaces: [
      {
        id: 'home',
        url: 'https://rolepatch.com/',
        md: 'https://rolepatch.com/index.md',
        kind: 'static',
        description: 'Product home',
      },
      {
        id: 'pricing',
        url: 'https://rolepatch.com/pricing',
        md: null,
        kind: 'static',
        description: 'Plans and limits',
      },
      {
        id: 'tools',
        url: 'https://rolepatch.com/tools',
        md: null,
        kind: 'static',
        description: 'Public tools',
      },
    ],
    auth: {
      public: true,
      notes: 'Auth-walled app routes are not agent-indexed unless listed here.',
    },
  },
  llmsFull: null,
};

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/llms.txt') {
    if (AGENT_SURFACE.skipLlms) return null;
    return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFull) {
    return text(AGENT_SURFACE.llmsFull, 'text/plain; charset=utf-8');
  }
  if (path === '/index.md') {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8');
  }
  if (path === '/api/ai') {
    const catalog = {
      ...AGENT_SURFACE.catalog,
      url: url.origin,
      llms: `${url.origin}/llms.txt`,
      sitemap: AGENT_SURFACE.catalog.sitemap
        ? String(AGENT_SURFACE.catalog.sitemap).replace(AGENT_SURFACE.url, url.origin)
        : `${url.origin}/sitemap.xml`,
      surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((s) => ({
        ...s,
        url: s.url ? String(s.url).replace(AGENT_SURFACE.url, url.origin) : s.url,
        md: s.md ? String(s.md).replace(AGENT_SURFACE.url, url.origin) : s.md,
      })),
    };
    return json(catalog);
  }

  if ((path === '/' || path === '') && wantsMarkdown(request)) {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
      Link: '</index.md>; rel="alternate"; type="text/markdown"',
      Vary: 'Accept',
    });
  }

  return null;
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function text(body, type, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      ...extra,
    },
  });
}

function json(data) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
