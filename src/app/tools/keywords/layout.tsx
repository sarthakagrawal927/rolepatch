import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free ATS Keyword Checker',
  description:
    'Check how well your resume matches a job description. See matched and missing keywords instantly. Free, no sign-up required.',
  alternates: { canonical: 'https://rolepatch.com/tools/keywords' },
};

export default function KeywordsToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
