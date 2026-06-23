'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { captureError } from '@/lib/foundry-monitoring';

export default function InterviewPrepError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    captureError(error, { scope: 'interview-prep', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold mb-3">Couldn&apos;t load interview prep</h2>
        <p className="text-sm opacity-70 mb-6">
          Something went wrong while preparing this page. Your saved stories are safe — try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded border hover:opacity-80">
            Try again
          </button>
          <Link href="/dashboard" className="px-4 py-2 rounded border hover:opacity-80">
            Dashboard
          </Link>
        </div>
        {error.digest ? <p className="mt-6 text-xs opacity-40">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
