'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  if (pathname === '/') return null;

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-1">
        <Link href="/" className="font-semibold text-foreground mr-6 flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center text-[10px] font-bold text-white">RP</span>
          RolePatch
        </Link>
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? 'bg-[var(--muted)] text-foreground font-medium'
                  : 'text-[var(--muted-foreground)] hover:text-foreground hover:bg-[var(--muted)]'
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
  );
}
