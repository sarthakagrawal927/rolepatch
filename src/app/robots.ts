import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/editor/', '/tailor/', '/cover-letter/'],
      },
    ],
    sitemap: 'https://rolepatch.com/sitemap.xml',
  };
}
