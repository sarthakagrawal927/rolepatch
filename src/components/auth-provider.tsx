'use client';

import { createContext, useContext } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

interface AuthContextValue {
  userId: string | null;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  userId: null,
  isGuest: true,
});

export function AuthProvider({ session, children }: { session: Session | null; children: React.ReactNode }) {
  const userId = session?.user?.id ?? null;
  return (
    <SessionProvider session={session}>
      <AuthContext.Provider value={{ isGuest: !userId, userId }}>
        {children}
      </AuthContext.Provider>
    </SessionProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
