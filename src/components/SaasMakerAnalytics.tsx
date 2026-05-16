'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { saasmaker } from '@/lib/saasmaker';

export function SaasMakerAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    // Swallow analytics failures (CORS, network, 4xx). The SaaS Maker SDK
    // throws on non-2xx, which would surface as an unhandled rejection /
    // "Failed to fetch" pageerror — telemetry must never crash the page.
    void Promise.resolve(saasmaker.analytics.track({ name: 'page_view', url: pathname })).catch(
      () => {},
    );
  }, [pathname]);

  return null;
}
