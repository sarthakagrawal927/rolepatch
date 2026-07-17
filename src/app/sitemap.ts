import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://rolepatch.com';
  const now = new Date();

  // Marketing + free tools + blog — the pages agents and Google should rank.
  // Auth-only surfaces (dashboard, tailor, cover-letter, interview-prep jobs) stay out.
  const paths: Array<{
    path: string;
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
    priority: number;
  }> = [
    { path: '', changeFrequency: 'weekly', priority: 1 },
    { path: '/pricing', changeFrequency: 'monthly', priority: 0.95 },
    { path: '/proof', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/evidence', changeFrequency: 'monthly', priority: 0.85 },

    // Free tools hub + each tool
    { path: '/tools', changeFrequency: 'weekly', priority: 0.95 },
    { path: '/tools/diff', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/tools/keywords', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/tools/ats-check', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/tools/bullet-check', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/tools/word-count', changeFrequency: 'monthly', priority: 0.75 },
    { path: '/tools/snippets', changeFrequency: 'monthly', priority: 0.75 },

    // Blog
    { path: '/blog', changeFrequency: 'weekly', priority: 0.85 },
    { path: '/blog/why-tailoring-resume-matters', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/blog/ats-score-explained', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/blog/resume-keywords-guide', changeFrequency: 'monthly', priority: 0.7 },

    // Agent / legal
    { path: '/llms.txt', changeFrequency: 'weekly', priority: 0.45 },
    { path: '/index.md', changeFrequency: 'weekly', priority: 0.45 },
    { path: '/api/ai', changeFrequency: 'weekly', priority: 0.4 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  ];

  return paths.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
