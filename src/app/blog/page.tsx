import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Resume tips, job search strategies, and AI-powered career advice from RolePatch.',
  alternates: { canonical: 'https://rolepatch.com/blog' },
};

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
}

const posts: BlogPost[] = [
  {
    slug: 'why-tailoring-resume-matters',
    title: 'Why Tailoring Your Resume for Every Job Actually Works',
    description:
      "Data shows tailored resumes get 3x more interviews. Here's the science behind keyword matching, ATS systems, and what recruiters actually look for.",
    date: '2026-03-16',
    readTime: '5 min',
  },
  {
    slug: 'ats-score-explained',
    title: 'ATS Scores Explained: What They Are and Why They Matter',
    description:
      'Most resumes are rejected by software before a human sees them. Learn how Applicant Tracking Systems work and how to beat them.',
    date: '2026-03-16',
    readTime: '4 min',
  },
  {
    slug: 'resume-keywords-guide',
    title: 'The Complete Guide to Resume Keywords in 2026',
    description:
      'Which keywords matter, which are filler, and how to find the right ones for any job description.',
    date: '2026-03-16',
    readTime: '6 min',
  },
];

export default function BlogPage() {
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
