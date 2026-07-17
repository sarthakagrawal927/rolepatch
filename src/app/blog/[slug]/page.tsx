import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { blogPostBySlug, blogSlugs } from '@/lib/blog-posts';

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://rolepatch.com/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      url: `https://rolepatch.com/blog/${slug}`,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: ['/og-image.png'],
    },
  };
}

export async function generateStaticParams() {
  return blogSlugs().map((slug) => ({ slug }));
}

export default async function BlogPost({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = blogPostBySlug(slug);
  if (!post) notFound();

  // Simple markdown-to-html (headings, bold, italic, links, lists)
  const html = post.content
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-foreground mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-foreground mt-10 mb-4">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-foreground">$1</em>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-[var(--accent)] hover:text-[var(--accent)]/80 underline underline-offset-2">$1</a>'
    )
    .replace(
      /^- (.+)$/gm,
      '<li class="ml-4 text-[var(--muted-foreground)] before:content-[\'•\'] before:mr-2 before:text-[var(--muted-foreground)]">$1</li>'
    )
    .replace(/\n\n/g, '</p><p class="text-[var(--muted-foreground)] leading-relaxed mb-4">')
    .replace(/^/, '<p class="text-[var(--muted-foreground)] leading-relaxed mb-4">')
    .replace(/$/, '</p>');

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/blog"
        className="text-sm text-[var(--muted-foreground)] hover:text-[var(--accent)] transition-colors mb-6 inline-block"
      >
        ← Back to blog
      </Link>
      <article>
        <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] mb-4">
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </time>
          <span>{post.readTime} read</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-8">{post.title}</h1>
        <div className="prose-custom" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
