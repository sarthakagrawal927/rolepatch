import type { Metadata } from 'next';

import { ToolSeo } from '@/components/tool-seo';

export const metadata: Metadata = {
  title: 'Free Resume Diff Tool — Compare Two Versions Word by Word',
  description:
    'Free resume diff tool. Paste two versions of your resume to see a word-level side-by-side diff with additions and removals counted. Split or inline view, runs in your browser, no sign-up.',
  alternates: { canonical: 'https://rolepatch.com/tools/diff' },
};

const faqs = [
  {
    question: 'How does the resume diff work?',
    answer:
      'You paste an original version and an updated version into two textareas and hit Compare. The tool renders a word-level diff using react-diff-viewer with the WORDS comparison method, highlighting every added and removed word. A header counts the additions and removals by comparing line by line.',
  },
  {
    question: 'Can I see the diff side by side or inline?',
    answer:
      'Yes. A toggle button switches between split view (Version A and Version B in two columns) and inline view (additions and removals interleaved in a single column). The default is split view.',
  },
  {
    question: 'Is my resume text uploaded anywhere?',
    answer:
      'No. Both versions stay in your browser. The diff is computed client-side — there is no upload, no account, and no server call.',
  },
  {
    question: 'How is this different from the diff in the full RolePatch app?',
    answer:
      'This standalone tool compares two texts you paste yourself. In the full app, RolePatch scrapes a job description, rewrites your resume with AI, and shows you the same word-level diff against your original so you can review every change before accepting it.',
  },
  {
    question: 'What format should I paste?',
    answer:
      'Plain text or markdown works best — the diff is line and word based, so paste the text of your resume rather than a rendered PDF. Markdown bullets and headings diff cleanly because the structure is visible as text.',
  },
];

export default function DiffToolLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo
        howItWorks={
          <>
            <p>
              Paste your original resume in the Version A box and the updated version in Version B,
              hit Compare, and the tool renders a word-level diff entirely in your browser. It uses
              react-diff-viewer with the WORDS comparison method, so individual changed words are
              highlighted rather than just whole lines.
            </p>
            <p>
              A header above the diff counts the additions and removals by comparing the two
              versions line by line. A toggle switches between split view (the two versions in
              side-by-side columns) and inline view (changes interleaved in one column), so you can
              scan for structural shifts or read the rewritten narrative depending on what you are
              checking.
            </p>
            <p>
              This is the same diff view RolePatch shows after its AI rewrites your resume against a
              job description. There, Version A is your original and Version B is the AI-tailored
              result &mdash; you review every word-level change before accepting.
            </p>
          </>
        }
        faqs={faqs}
      />
    </>
  );
}
