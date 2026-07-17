import type { Metadata } from 'next';

import { ToolSeo } from '@/components/tool-seo';

export const metadata: Metadata = {
  title: 'Free ATS Resume Checker — Formatting & Parseability Scan',
  description:
    'Free ATS resume checker. Paste your resume to catch missing sections, contact info gaps, table traps, low bullet density, and missing dates — scored 0-100, all in your browser.',
  alternates: { canonical: 'https://rolepatch.com/tools/ats-check' },
};

const faqs = [
  {
    question: 'Is this ATS checker really free with no sign-up?',
    answer:
      'Yes. Paste your resume text and the scan runs instantly in your browser. There is no account, no upload, and no network call — your text never leaves the page.',
  },
  {
    question: 'What does the ATS check score actually measure?',
    answer:
      'It runs seven local heuristics: word count (flags under 200 or over 1300 words), presence of the Experience / Education / Skills / Projects sections, contact info (email plus a phone or LinkedIn URL), bullet-line density, numeric quantification, pipe-delimited table rows that ATS parsers flatten, and date coverage. You start at 100 and lose 5 points per warning and 15 per failure.',
  },
  {
    question: 'Does it check ATS keyword match against a job description?',
    answer:
      'No — that is the separate Keyword Checker tool. This page only checks whether your resume is structured and parseable. Use the Keyword Checker to compare your resume against a specific job description.',
  },
  {
    question: 'What resume format should I paste in?',
    answer:
      'Markdown or plain text works best. The section-header check looks for the words "experience", "education", "skills", and "projects", and the bullet check counts lines starting with -, *, or •. Paste the text version of your resume, not a PDF or image.',
  },
  {
    question: 'Why does it warn about pipe-delimited rows?',
    answer:
      'Lines containing three or more pipe-separated columns look like a table to a human, but many ATS parsers flatten or misparse them. The checker flags three or more such rows so you can convert them to plain bullets.',
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo
        howItWorks={
          <>
            <p>
              Paste your resume as markdown or plain text and the checker runs seven local
              heuristics against it — no network call, so your text never leaves the page. It flags
              a word count outside the 200&ndash;1300 range, missing standard sections (Experience,
              Education, Skills, Projects), absent contact info (it looks for an email plus a phone
              number or LinkedIn URL), low bullet density, too few quantified outcomes,
              pipe-delimited table rows that ATS parsers flatten, and missing dates.
            </p>
            <p>
              Each check is marked good, warn, or fail. The score starts at 100 and drops 5 points
              per warning and 15 per failure, clamped to 0&ndash;100. The findings list tells you
              exactly which heuristic tripped and why, so you can fix the underlying structure
              rather than guessing.
            </p>
            <p>
              This tool checks parseability and structure only. To measure keyword match against a
              specific job description, use the{' '}
              <a
                href="/tools/keywords"
                className="text-[var(--accent)] underline underline-offset-2"
              >
                ATS Keyword Checker
              </a>
              .
            </p>
          </>
        }
        faqs={faqs}
      />
    </>
  );
}
