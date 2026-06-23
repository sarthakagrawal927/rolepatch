'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getTokenBalance } from '@/lib/actions/token-actions';

export function TokenBalance() {
  const { isGuest } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (isGuest) return;
    getTokenBalance()
      .then(setBalance)
      .catch(() => {});
  }, [isGuest]);

  if (isGuest || balance === null) return null;

  return (
    <Link
      href="/pricing"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--muted-foreground)] transition-colors"
      title="Token balance"
    >
      <span className="text-xs">&#9889;</span>
      <span className="text-[var(--accent)] font-semibold text-xs">{balance}</span>
    </Link>
  );
}
