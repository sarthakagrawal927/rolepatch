import type { Metadata } from 'next';

import { ToolSeo } from '@/components/tool-seo';

export const metadata: Metadata = {
  title: 'Free ATS Keyword Checker — Resume vs Job Description Match',
  description:
    'Free ATS keyword checker. Paste your resume and a job description to see a match score, matched keywords, and the exact keywords you are missing. Runs in your browser, no sign-up.',
  alternates: { canonical: 'https://rolepatch.com/tools/keywords' },
};

const faqs = [
  {
    question: 'How is the ATS keyword match score calculated?',
    answer:
      'The tool tokenizes the job description, strips stop words and generic filler words (like "experience", "team", "role"), and extracts single words plus two-word bigrams. Any keyword appearing two or more times in the JD is treated as "important" and weighted at 70% of the score; the rest are "regular" and weighted at 30%. The final score is the weighted percentage of keywords found in your resume.',
  },
  {
    question: 'Does the keyword checker send my resume anywhere?',
    answer:
      'No. The comparison runs entirely in your browser. Both textareas are processed locally with JavaScript — there is no upload, no account, and no server call.',
  },
  {
    question: 'Why are some keywords marked "important" and others "regular"?',
    answer:
      'Keywords that appear two or more times in the job description are promoted to "important" because repetition signals the employer weights them heavily. If no keyword repeats, every keyword is promoted to important so you still get a usable score.',
  },
  {
    question: 'What counts as a keyword versus a filler word?',
    answer:
      'The extractor removes common English stop words (the, and, of, with…) and resume filler words (experience, skills, responsibilities, required, preferred…). It also ignores tokens shorter than three characters. What remains — skills, tools, technologies, domain terms — are treated as keywords.',
  },
  {
    question: 'How do I improve my match score?',
    answer:
      'The "Missing keywords" list shows exactly which JD terms are not in your resume. Add the ones you genuinely have using the same phrasing as the job description. RolePatch can do this automatically — paste the job URL and the AI rewrites your resume, then shows you a word-level diff.',
  },
];

export default function KeywordsToolLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo
        howItWorks={
          <>
            <p>
              Paste your resume in one box and the job description in the other, hit Analyze, and
              the tool computes a 0&ndash;100 match score entirely in your browser. It tokenizes the
              job description, removes English stop words and generic resume filler (words like
              &ldquo;experience&rdquo;, &ldquo;team&rdquo;, &ldquo;required&rdquo;), and extracts
              single-word terms plus two-word bigrams.
            </p>
            <p>
              Keywords that appear two or more times in the JD are treated as
              &ldquo;important&rdquo; and carry 70% of the score weight; one-off keywords carry 30%.
              The tool then checks which of those keywords appear as a substring in your resume and
              splits them into a matched list and a missing list, so you can see exactly which terms
              to add.
            </p>
            <p>
              This is the same scoring engine RolePatch uses inside the full tailor flow. The
              difference is that here you bring both texts yourself; in the app you paste a job URL,
              RolePatch scrapes the JD, rewrites your resume to close the keyword gaps, and shows
              you a{' '}
              <a href="/tools/diff" className="text-[var(--accent)] underline underline-offset-2">
                word-level diff
              </a>{' '}
              before you accept.
            </p>
          </>
        }
        faqs={faqs}
      />
    </>
  );
}
