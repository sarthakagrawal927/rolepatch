import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Resume Tools',
  description:
    'Free resume tools — ATS keyword check, resume diff, formatting check, bullet strength, word count, and snippet library. No sign-up required.',
  alternates: { canonical: 'https://rolepatch.com/tools' },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
