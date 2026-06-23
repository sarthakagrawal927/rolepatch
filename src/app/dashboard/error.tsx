'use client';

import { useEffect } from 'react';

import { captureError } from '@/lib/foundry-monitoring';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    captureError(error, { scope: 'dashboard', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold mb-3">Couldn&apos;t load your dashboard</h2>
        <p className="text-sm opacity-70 mb-6">
          Something went wrong while loading your resumes and jobs. Your data is safe — try again.
        </p>
        <button onClick={reset} className="px-4 py-2 rounded border hover:opacity-80">
          Try again
        </button>
        {error.digest ? <p className="mt-6 text-xs opacity-40">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
