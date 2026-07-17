import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free ATS Formatting Check',
  description:
    'Catch tables, columns, headers, emojis, and other layout traps that break ATS parsers. Free, no sign-up required.',
  alternates: { canonical: 'https://rolepatch.com/tools/ats-check' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
