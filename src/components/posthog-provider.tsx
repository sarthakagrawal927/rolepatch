'use client';

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, useRef } from 'react';

import { trackReturned } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';
import { installBrowserMonitoring } from '@/lib/foundry-monitoring';

// Mirrors the key written by auth-provider.tsx — a user already in this list
// has prior activity, so a fresh session for them counts as a `returned` visit.
const SEEN_USERS_KEY = 'rp:seen-users';
// Per-tab guard so `returned` fires at most once per session start.
const RETURNED_FIRED_KEY = 'rp:returned-fired';

function hasPriorActivity(userId: string): boolean {
  try {
    const raw = localStorage.getItem(SEEN_USERS_KEY);
    const seen = raw ? (JSON.parse(raw) as string[]) : [];
    return seen.includes(userId);
  } catch {
    return false;
  }
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const firedRef = useRef(false);

  useEffect(() => {
    return installBrowserMonitoring();
  }, []);

  // Fire `returned` once per session start for a user with prior activity.
  useEffect(() => {
    if (!userId || firedRef.current || typeof window === 'undefined') return;
    if (!hasPriorActivity(userId)) return; // first-ever session → counts as signup, not returned
    try {
      if (sessionStorage.getItem(RETURNED_FIRED_KEY) === userId) return;
      sessionStorage.setItem(RETURNED_FIRED_KEY, userId);
    } catch {
      // sessionStorage unavailable — fall back to the in-memory ref guard.
    }
    firedRef.current = true;
    trackReturned();
  }, [userId]);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
