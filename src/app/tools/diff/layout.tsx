import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Resume Diff Tool',
  description:
    'Compare two versions of your resume side by side. See exactly what changed, word by word. Free, no sign-up required.',
  alternates: { canonical: 'https://rolepatch.com/tools/diff' },
};

export default function DiffToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
