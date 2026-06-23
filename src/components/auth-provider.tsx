'use client';

import { createContext, useContext, useEffect } from 'react';

import { trackSignup } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';

interface AuthContextValue {
  userId: string | null;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  userId: null,
  isGuest: true,
});

// localStorage key recording every userId this browser has seen signed in.
// Used to distinguish a brand-new account (signup) from a return visit.
const SEEN_USERS_KEY = 'rp:seen-users';

function readSeenUsers(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_USERS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  // Fire `signup` once, on the first session we ever see for this account.
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;
    const seen = readSeenUsers();
    if (seen.includes(userId)) return;
    trackSignup();
    try {
      localStorage.setItem(SEEN_USERS_KEY, JSON.stringify([...seen, userId]));
    } catch {
      // Non-fatal — worst case the event de-dupes on the next visit.
    }
  }, [userId]);

  return (
    <AuthContext.Provider value={{ isGuest: !userId, userId }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
