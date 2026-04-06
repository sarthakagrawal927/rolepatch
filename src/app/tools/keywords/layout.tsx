import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free ATS Keyword Checker | RolePatch',
  description:
    'Check how well your resume matches a job description. See matched and missing keywords instantly. Free, no sign-up required.',
};

export default function KeywordsToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
