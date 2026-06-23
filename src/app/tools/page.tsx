import {
  ArrowRight,
  CheckSquare,
  GitCompare,
  Hash,
  ListChecks,
  Search,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

const tools = [
  {
    href: '/tools/diff',
    icon: GitCompare,
    title: 'Resume Diff Tool',
    desc: 'Compare two versions of your resume side by side with word-level diff highlighting.',
  },
  {
    href: '/tools/keywords',
    icon: Search,
    title: 'ATS Keyword Checker',
    desc: 'Check how well your resume matches a job description and see matched vs missing keywords.',
  },
  {
    href: '/tools/ats-check',
    icon: CheckSquare,
    title: 'ATS Formatting Check',
    desc: 'Catch tables, columns, headers, emojis, and other layout traps that break ATS parsers.',
  },
  {
    href: '/tools/snippets',
    icon: Sparkles,
    title: 'Bullet Snippet Library',
    desc: 'Stash reusable accomplishment bullets and copy them into any resume in one click.',
  },
  {
    href: '/tools/bullet-check',
    icon: ListChecks,
    title: 'Bullet Strength Checker',
    desc: 'Paste any bullet to grade verb strength, quantified outcome, length, tense, and pronouns.',
  },
  {
    href: '/tools/word-count',
    icon: Hash,
    title: 'Resume Word Count',
    desc: 'Word, sentence, and density stats — keep each section in the sweet spot.',
  },
];

export default function ToolsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Free Resume Tools
        </h1>
        <p className="text-[var(--muted-foreground)] text-lg max-w-xl mx-auto mt-4">
          No sign-up required. Use these tools to improve your resume right now.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group relative bg-[var(--card)] rounded-2xl border border-[var(--border)]/60 p-8 hover:border-[var(--accent)]/40 hover:shadow-xl hover:shadow-[var(--accent)]/5 transition-all duration-300 hover:translate-y-[-4px]"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] mb-6 group-hover:scale-110 transition-transform duration-300">
              <tool.icon className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-xl font-bold text-foreground mb-2">{tool.title}</h2>
            <p className="text-[var(--muted-foreground)] text-sm leading-relaxed">{tool.desc}</p>
            <span className="inline-flex items-center gap-1 mt-6 text-sm font-medium text-[var(--accent)] group-hover:translate-x-1 transition-transform">
              Use tool <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
