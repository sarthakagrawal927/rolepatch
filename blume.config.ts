import { defineConfig } from 'blume';

/**
 * Blume configuration for the RolePatch docs site.
 *
 * The committed Markdown under docs/ is the source of truth. Blume is
 * only the presentation and search layer — generated output (.blume/,
 * dist/) is gitignored and never committed. See
 * docs/development/docs.md for the documentation rules.
 *
 * Usage:
 *   pnpm docs:check     # link + frontmatter + structure validation
 *   pnpm docs:build     # Blume build → dist/
 *   pnpm docs:dev       # Blume dev server
 *
 * CI runs `pnpm docs:check` via .github/workflows/docs.yml.
 */
export default defineConfig({
  title: 'RolePatch docs',
  description:
    'Local-first knowledge system for RolePatch — the AI resume and job-application assistant on Cloudflare Workers.',

  content: {
    root: 'docs',
    // Render committed Markdown as the docs site. Archive is preserved
    // for git history and reachable via the repo, not as canonical
    // Blume pages. See docs/development/docs.md.
    include: ['**/*.md'],
    exclude: ['archive/**'],
  },

  theme: {
    accent: 'indigo',
    radius: 'md',
    mode: 'system',
  },

  search: {
    provider: 'orama',
  },

  markdown: {
    imageZoom: true,
    code: {
      icons: true,
      wrap: false,
    },
    codeBlocks: {
      theme: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },

  ai: {
    llmsTxt: true,
    mcp: {
      enabled: false,
      route: '/mcp',
    },
  },

  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
    structuredData: true,
  },

  deployment: {
    output: 'static',
    // No canonical docs site URL yet — set this when the docs site is
    // published (e.g. https://docs.rolepatch.com). Leaving it unset
    // keeps sitemap/feeds off until a site is chosen.
    // site: "https://docs.rolepatch.com",
  },
});
