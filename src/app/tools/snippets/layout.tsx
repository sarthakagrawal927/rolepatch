import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Bullet Snippet Library',
  description:
    'Stash reusable accomplishment bullets and copy them into any resume in one click. Free, no sign-up required.',
  alternates: { canonical: 'https://rolepatch.com/tools/snippets' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
