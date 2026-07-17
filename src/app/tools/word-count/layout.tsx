import type { Metadata } from 'next';

import { ToolSeo } from '@/components/tool-seo';

export const metadata: Metadata = {
  title: 'Free Resume Word Count — Words, Sentences, Bullets & Skim Time',
  description:
    'Free resume word count tool. Paste any text to get word, character, line, sentence, paragraph, and bullet counts plus an estimated recruiter skim time. Runs locally, no sign-up.',
  alternates: { canonical: 'https://rolepatch.com/tools/word-count' },
};

const faqs = [
  {
    question: 'What counts does the word count tool report?',
    answer:
      'It reports total characters, characters excluding spaces, words, lines, sentences, paragraphs (blocks separated by a blank line), bullet rows (lines starting with -, *, or •), and an estimated skim time. All counts are computed locally in your browser.',
  },
  {
    question: 'How is the skim time estimated?',
    answer:
      'Skim time uses a 230 words-per-minute read rate, which is the typical speed recruiters skim resume and bullet copy. Total words are divided by 230 and converted to seconds, then formatted as seconds or minutes.',
  },
  {
    question: 'Is anything uploaded or sent to a server?',
    answer:
      'No. The text you paste stays in your browser. The analysis is a pure client-side function with no network call, no account, and no storage.',
  },
  {
    question: 'What is a good word count for a resume?',
    answer:
      'Most one-page resumes land between 400 and 900 words. The companion ATS Formatting Checker flags resumes under 200 or over 1300 words as a warning. Use this tool to keep each section in a sane range rather than hitting an arbitrary total.',
  },
  {
    question: 'Can I use this for cover letters or other text?',
    answer:
      'Yes. The tool is format-agnostic — paste a cover letter, bio, or any block of text and you get the same character, word, sentence, paragraph, and bullet counts plus skim time.',
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
              Paste any text &mdash; a resume, cover letter, or bio &mdash; and the tool returns
              eight counts instantly, all computed locally in your browser with no network call. It
              measures total characters, characters excluding spaces, words, lines, sentences (text
              ending in .!?), paragraphs (blocks split by a blank line), and bullet rows (lines
              starting with -, *, or •).
            </p>
            <p>
              It also estimates recruiter skim time at a 230 words-per-minute read rate, the typical
              speed recruiters scan resume and bullet copy. That gives you a realistic sense of how
              long a human will actually spend on the page before deciding to keep reading.
            </p>
            <p>
              Pair it with the{' '}
              <a
                href="/tools/ats-check"
                className="text-[var(--accent)] underline underline-offset-2"
              >
                ATS Formatting Checker
              </a>{' '}
              to see whether your word count falls in the readable 200&ndash;1300 range and whether
              your bullet density is high enough.
            </p>
          </>
        }
        faqs={faqs}
      />
    </>
  );
}
