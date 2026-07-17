import './globals.css';

import type { Metadata, Viewport } from 'next';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

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
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RolePatch — See every change in your resume',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sarthakcodes',
    creator: '@sarthakcodes',
    title: 'RolePatch — AI Resume Tailoring with Diff View',
    description: 'Tailor your resume to any job description with AI. See exactly what changed.',
    images: ['/og-image.png'],
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
  // No site-wide canonical — it was inherited by every page (including /tools/*)
  // and de-indexed free tools. Homepage and routes set self-canonicals.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'RolePatch',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              url: 'https://rolepatch.com',
              description:
                'AI-powered resume tailoring with job fit scoring, interview prep, and transparent diff view. See exactly what changed, word by word.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                description: '3 free tokens to start. No credit card required.',
              },
            }),
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AnalyticsProvider>
          <SaaSMakerFeedback />
          <AuthProvider>
            <SiteNav />
            {children}
            <footer className="border-t border-border/60 px-6 py-6 text-sm text-muted-foreground">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                <span>RolePatch</span>
                <a href="/proof" className="transition-colors hover:text-foreground">
                  TrueHire proof
                </a>
              </div>
            </footer>
          </AuthProvider>
          <VitalsReporter />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
