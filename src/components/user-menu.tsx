'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { captureAuthFailure } from '@/lib/foundry-monitoring';

export function UserMenu() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  if (!session?.user) {
    function handleSignIn() {
      authClient.signIn
        .social({ provider: 'google', callbackURL: '/' })
        .then((result) => {
          if (result?.error) {
            captureAuthFailure({
              projectSlug: 'resume-tailor',
              provider: 'google',
              stage: 'signin',
              reason: result.error.message ?? 'Google sign-in failed',
              source: 'user-menu',
            });
          }
        })
        .catch((error: unknown) => {
          captureAuthFailure({
            projectSlug: 'resume-tailor',
            provider: 'google',
            stage: 'signin',
            reason: error instanceof Error ? error.message : 'Google sign-in failed',
            source: 'user-menu',
          });
        });
    }

    return (
      <button
        onClick={handleSignIn}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white text-gray-900 hover:bg-gray-200 transition-colors"
      >
        Sign in
      </button>
    );
  }

  const { name, email, image } = session.user;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={28}
            height={28}
            className="rounded-full ring-2 ring-[var(--border)]"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs font-medium ring-2 ring-[var(--border)]">
            {(name ?? '?')[0]}
          </div>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50 modal-content">
          <div className="px-3 py-2 text-sm text-foreground border-b border-[var(--border)] truncate">
            {email}
          </div>
          <button
            onClick={() => authClient.signOut()}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-[var(--muted)] transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
