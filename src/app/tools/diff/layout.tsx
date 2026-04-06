import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Resume Diff Tool | RolePatch',
  description:
    'Compare two versions of your resume side by side. See exactly what changed, word by word. Free, no sign-up required.',
};

export default function DiffToolLayout({ children }: { children: React.ReactNode }) {
  return children;
}
