import type { Metadata } from 'next';
import Link from 'next/link';

import { blogPosts } from '@/lib/blog-posts';

export const metadata: Metadata = {
  title: 'Blog — Resume Tips & Job Search Strategies',
  description: 'Resume tips, job search strategies, and AI-powered career advice from RolePatch.',
  alternates: {
    canonical: 'https://rolepatch.com/blog',
    types: {
      'application/rss+xml': 'https://rolepatch.com/blog/rss.xml',
    },
  },
};

export default function BlogPage() {
  const posts = [...blogPosts].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Resume tips, job search strategies, and career advice.
        </p>
      </div>

      <div className="space-y-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/[0.02] transition-all"
          >
            <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] mb-3">
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
              <span>{post.readTime} read</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">{post.title}</h2>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              {post.description}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
