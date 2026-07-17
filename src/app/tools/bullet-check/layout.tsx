import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Bullet Strength Checker',
  description:
    'Paste any resume bullet to grade verb strength, quantified outcome, length, tense, and pronouns. Free, no sign-up required.',
  alternates: { canonical: 'https://rolepatch.com/tools/bullet-check' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
