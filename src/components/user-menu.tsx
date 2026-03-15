'use client';

import Image from 'next/image';
import { useAuth } from '@/components/auth-provider';
import { signIn, signOut } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';

interface SessionData {
  user?: {
    name?: string;
    email?: string;
    image?: string;
  };
}

export function UserMenu() {
  const { isGuest } = useAuth();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isGuest) {
      fetch('/api/auth/session')
        .then((r) => r.json())
        .then(setSession)
        .catch(() => {});
    }
  }, [isGuest]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (isGuest) {
    return (
      <button
        onClick={() => signIn('google')}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-gray-900 hover:bg-gray-200 transition-colors"
      >
        Sign in
      </button>
    );
  }

  const name = session?.user?.name ?? '';
  const email = session?.user?.email ?? '';
  const image = session?.user?.image;

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        {image ? (
          <Image src={image} alt="" width={28} height={28} className="rounded-full ring-2 ring-gray-700" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-medium ring-2 ring-gray-700">
            {name[0] ?? '?'}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-1 z-50 modal-content">
          <div className="px-3 py-2 text-sm text-gray-300 border-b border-gray-800 truncate">
            {email}
          </div>
          <button
            onClick={() => signOut()}
            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
