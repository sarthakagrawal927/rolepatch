import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface BlogContent {
  title: string;
  description: string;
  date: string;
  readTime: string;
  content: string;
}

const posts: Record<string, BlogContent> = {
  'why-tailoring-resume-matters': {
    title: 'Why Tailoring Your Resume for Every Job Actually Works',
    description: 'Data shows tailored resumes get 3x more interviews.',
    date: '2026-03-16',
    readTime: '5 min',
    content: `## The Numbers Don't Lie

A controlled experiment on Reddit tested identical candidates applying to 58 jobs — 29 with a generic resume and 29 with tailored versions. The result: **5 interviews from tailored applications, 0 from generic ones.**

That's not a marginal improvement. That's the difference between getting interviews and getting nothing.

## How ATS Systems Filter You Out

Over 90% of large companies use Applicant Tracking Systems (ATS) to screen resumes before a human ever sees them. These systems scan for keyword matches between your resume and the job description.

If the job asks for "project management" and your resume says "managed projects," some ATS systems won't catch the match. If the JD emphasizes "Python" and you buried it in line 47, the score drops.

## What "Tailoring" Actually Means

It's not rewriting your entire resume for each job. It's:

1. **Keyword alignment** — using the same terminology as the job description
2. **Priority reordering** — putting the most relevant skills and experiences first
3. **Bullet point tuning** — emphasizing the outcomes that match what the role needs
4. **Removing noise** — cutting irrelevant experience that dilutes your match score

## The Problem: It Takes Forever

At 30 minutes per tailored resume, applying to 5 jobs per day means 2.5 hours just on resume tweaking. That's why most people don't do it — and why those who do have a massive advantage.

## The Solution: AI + Transparency

Tools like [RolePatch](/) can tailor your resume in seconds. But the key differentiator is **seeing what changed**. A diff view shows you every word the AI modified, so you stay in control and your resume still sounds like you.

[Try RolePatch free — 3 tokens, no credit card →](/dashboard)`,
  },
  'ats-score-explained': {
    title: 'ATS Scores Explained: What They Are and Why They Matter',
    description: 'Most resumes are rejected by software before a human sees them.',
    date: '2026-03-16',
    readTime: '4 min',
    content: `## What Is an ATS Score?

An ATS (Applicant Tracking System) score is a numerical match between your resume and a job description. It typically ranges from 0 to 100, where higher means your resume contains more of the keywords and qualifications the employer is looking for.

## How It Works

The system extracts keywords from the job description — skills, tools, certifications, job titles — and checks how many appear in your resume. Some systems also look for:

- **Keyword frequency** — mentioned once vs. demonstrated throughout
- **Keyword proximity** — related terms near each other (e.g., "Python" near "data analysis")
- **Section matching** — skills in a skills section vs. buried in a paragraph
- **Exact vs. fuzzy matching** — "JavaScript" vs. "JS" vs. "ECMAScript"

## What Score Do You Need?

Most ATS systems use a threshold — typically 60-80% — below which your resume is automatically rejected. The exact threshold varies by company and role.

**A good target:** 75+ for most roles. 85+ for competitive positions.

## How to Check Your Score

You can use [RolePatch's free keyword checker](/tools/keywords) to see your match score instantly. Paste your resume and the job description, and see exactly which keywords you're matching and which you're missing.

## How to Improve It

1. **Mirror the JD language** — if they say "stakeholder management," use that exact phrase
2. **Include hard skills** — tools, languages, certifications are heavily weighted
3. **Use standard section headers** — "Experience," "Education," "Skills" (not creative alternatives)
4. **Avoid images and tables** — most ATS systems can't parse them

[Check your ATS score free →](/tools/keywords)`,
  },
  'resume-keywords-guide': {
    title: 'The Complete Guide to Resume Keywords in 2026',
    description: 'Which keywords matter, which are filler, and how to find the right ones.',
    date: '2026-03-16',
    readTime: '6 min',
    content: `## Keywords Are the Bridge

Keywords connect your experience to what the employer is looking for. They're the terms that ATS systems scan for and that recruiters skim for in the first 6 seconds of reading your resume.

## Types of Keywords

### Hard Skills (Highest Weight)
Programming languages, tools, platforms, certifications. These are binary — you either know Python or you don't.

*Examples: React, AWS, Kubernetes, PMP, SQL, Figma, Tableau*

### Soft Skills (Low Weight Alone)
Generic traits like "team player" or "detail-oriented" carry almost no weight unless backed by evidence.

*Better approach:* Instead of "strong communicator," write "Presented quarterly results to C-suite stakeholders across 4 departments."

### Action Verbs (Medium Weight)
Verbs that match the JD's level of responsibility signal fit.

*Junior:* built, implemented, developed, supported
*Senior:* led, architected, designed, mentored, scaled
*Executive:* transformed, established, drove, championed

### Industry Terms (High Weight)
Every industry has jargon. Using it signals insider knowledge.

*Tech:* microservices, CI/CD, agile, sprint, SLA
*Finance:* P&L, due diligence, compliance, risk assessment
*Marketing:* CAC, LTV, conversion rate, attribution

## How to Find the Right Keywords

1. **Read the JD three times** — once for overview, once for required skills, once for nice-to-haves
2. **Look for repeated words** — if "data analysis" appears 4 times, it's critical
3. **Check "requirements" vs. "nice to have"** — requirements are must-match keywords
4. **Use the keyword checker** — [RolePatch's free tool](/tools/keywords) extracts and compares automatically

## Common Mistakes

- **Keyword stuffing** — cramming keywords unnaturally. ATS may pass it but humans will reject it.
- **Using abbreviations only** — write "Search Engine Optimization (SEO)" the first time, then "SEO" after.
- **Ignoring the JD** — your resume should be a response to the job description, not a generic history.

[Analyze your resume keywords free →](/tools/keywords)`,
  },
};

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = posts[slug];
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
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }));
}

export default async function BlogPost({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = posts[slug];
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
