import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://rolepatch.com';
  const now = new Date();

  // Public marketing + content only (no auth dashboard).
  const paths: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }> =
    [
      { path: '', changeFrequency: 'weekly', priority: 1 },
      { path: '/proof', changeFrequency: 'monthly', priority: 0.85 },
      { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
      { path: '/tools', changeFrequency: 'monthly', priority: 0.85 },
      { path: '/tools/diff', changeFrequency: 'monthly', priority: 0.75 },
      { path: '/tools/keywords', changeFrequency: 'monthly', priority: 0.75 },
      { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
      { path: '/blog/why-tailoring-resume-matters', changeFrequency: 'monthly', priority: 0.65 },
      { path: '/blog/ats-score-explained', changeFrequency: 'monthly', priority: 0.65 },
      { path: '/blog/resume-keywords-guide', changeFrequency: 'monthly', priority: 0.65 },
      { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
      { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
      { path: '/llms.txt', changeFrequency: 'weekly', priority: 0.45 },
      { path: '/index.md', changeFrequency: 'weekly', priority: 0.45 },
      { path: '/api/ai', changeFrequency: 'weekly', priority: 0.4 },
    ];

  return paths.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
