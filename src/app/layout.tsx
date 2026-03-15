import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AuthProvider } from "@/components/auth-provider";
import { UserMenu } from "@/components/user-menu";
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
  title: "Resume Tailor",
  description: "Tailor your resume to job descriptions with AI",
};

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stash", label: "Stash" },
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
                  <span className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">R</span>
                  Resume Tailor
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
                <div className="ml-auto">
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
