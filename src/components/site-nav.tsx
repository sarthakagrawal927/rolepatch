'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { TokenBalance } from '@/components/token-balance';
import { UserMenu } from '@/components/user-menu';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tools', label: 'Free Tools' },
  { href: '/evidence', label: 'Evidence' },
  { href: '/stash', label: 'Stash' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/settings', label: 'Settings' },
];

export function SiteNav() {
  const pathname = usePathname() ?? '';
  const [menuOpen, setMenuOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(pathname);

  // Close the mobile menu when the route changes (render-phase reset —
  // avoids a setState-in-effect cascading render).
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setMenuOpen(false);
  }

  if (pathname === '/') return null;

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-1">
        <Link
          href="/"
          prefetch={false}
          className="font-semibold text-foreground mr-auto md:mr-6 flex items-center gap-2"
        >
          <span className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center text-[10px] font-bold text-white">
            RP
          </span>
          RolePatch
        </Link>

        {/* Desktop links */}
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className={`hidden md:block px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? 'bg-[var(--muted)] text-foreground font-medium'
                  : 'text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--muted)]'
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <TokenBalance />
          <UserMenu />
          {/* Hamburger — only under md */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="md:hidden flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--muted)] transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--background)] px-4 py-2">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center min-h-[44px] px-3 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-[var(--muted)] text-foreground font-medium'
                      : 'text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--muted)]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
