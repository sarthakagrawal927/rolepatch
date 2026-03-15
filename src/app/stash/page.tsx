export const dynamic = 'force-dynamic';

import { listStashEntries } from '@/lib/actions/stash-actions';
import { StashList } from '@/components/stash-list';

export default async function StashPage() {
  const entries = await listStashEntries();

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Stash</h1>
        <p className="text-sm text-gray-400 mt-1">
          Extra content blocks the AI can pull from when tailoring your resume for specific jobs.
        </p>
      </div>
      <StashList serverEntries={entries} />
    </main>
  );
}
