import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Resume Tailor",
  description: "Tailor your resume to job descriptions with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-6">
            <Link href="/" className="font-semibold">
              Resume Tailor
            </Link>
            <Link
              href="/settings"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Settings
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
