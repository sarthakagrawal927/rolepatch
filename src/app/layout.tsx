import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AuthProvider } from "@/components/auth-provider";
import { UserMenu } from "@/components/user-menu";
import { TokenBalance } from "@/components/token-balance";
import { SaasMakerAnalytics } from "@/components/SaasMakerAnalytics";
import { SaaSMakerFeedback } from "@/components/saasmaker-feedback";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RolePatch — AI Resume Tailoring with Diff View",
    template: "%s | RolePatch",
  },
  description: "Tailor your resume to any job description with AI. See exactly what changed word by word. Free ATS scoring, cover letters, and keyword analysis.",
  keywords: ["resume tailor", "AI resume", "ATS score", "resume diff", "job application", "cover letter generator", "resume keywords", "resume optimizer"],
  authors: [{ name: "RolePatch" }],
  creator: "RolePatch",
  metadataBase: new URL("https://rolepatch.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rolepatch.com",
    siteName: "RolePatch",
    title: "RolePatch — AI Resume Tailoring with Diff View",
    description: "Tailor your resume to any job description with AI. See exactly what changed word by word.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "RolePatch — See every change in your resume" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RolePatch — AI Resume Tailoring with Diff View",
    description: "Tailor your resume to any job description with AI. See exactly what changed.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: {
    canonical: "https://rolepatch.com",
  },
};

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stash", label: "Stash" },
  { href: "/pricing", label: "Pricing" },
  { href: "/settings", label: "Settings" },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isLanding = pathname === "/";

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SaasMakerAnalytics />
        <SaaSMakerFeedback />
        <AuthProvider session={session}>
          {!isLanding && (
            <nav className="sticky top-0 z-40 border-b border-gray-800/80 bg-[#0a0a0a]/80 backdrop-blur-xl">
              <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-1">
                <Link href="/" className="font-semibold text-white mr-6 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">RP</span>
                  RolePatch
                </Link>
                {NAV_LINKS.map((link) => {
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        isActive
                          ? "bg-gray-800 text-white font-medium"
                          : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <div className="ml-auto flex items-center gap-3">
                  <TokenBalance />
                  <UserMenu />
                </div>
              </div>
            </nav>
          )}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
