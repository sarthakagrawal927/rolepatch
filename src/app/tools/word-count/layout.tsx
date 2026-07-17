import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Resume Word Count',
  description:
    'Word, sentence, and density stats — keep each resume section in the sweet spot. Free, no sign-up required.',
  alternates: { canonical: 'https://rolepatch.com/tools/word-count' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
