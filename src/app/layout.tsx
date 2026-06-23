import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { AuthProvider } from '@/components/auth-provider';
import { AnalyticsProvider } from '@/components/posthog-provider';
import { SaaSMakerFeedback } from '@/components/saasmaker-feedback';
import { SiteNav } from '@/components/site-nav';
import { VitalsReporter } from '@/components/VitalsReporter';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  // Mono is used in the LaTeX editor, not on the landing LCP path.
  // Skipping preload keeps the Geist sans (LCP) the only font early.
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: 'RolePatch — AI Resume Tailoring with Diff View',
    template: '%s | RolePatch',
  },
  description:
    'Tailor your resume to any job description with AI. Job fit scoring, interview prep with STAR stories, ATS optimization, cover letters, and word-level diff view.',
  keywords: [
    'resume tailor',
    'AI resume',
    'ATS score',
    'resume diff',
    'job application',
    'cover letter generator',
    'resume keywords',
    'resume optimizer',
    'job fit score',
    'interview prep',
    'STAR stories',
  ],
  authors: [{ name: 'RolePatch' }],
  creator: 'RolePatch',
  metadataBase: new URL('https://rolepatch.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rolepatch.com',
    siteName: 'RolePatch',
    title: 'RolePatch — AI Resume Tailoring with Diff View',
    description:
      'Tailor your resume to any job description with AI. See exactly what changed word by word.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'RolePatch — See every change in your resume',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RolePatch — AI Resume Tailoring with Diff View',
    description: 'Tailor your resume to any job description with AI. See exactly what changed.',
    images: ['/og-image.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://rolepatch.com',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AnalyticsProvider>
          <SaaSMakerFeedback />
          <AuthProvider>
            <SiteNav />
            {children}
          </AuthProvider>
          <VitalsReporter />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
