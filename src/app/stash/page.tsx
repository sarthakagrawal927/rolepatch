export const dynamic = 'force-dynamic';

import { listStashEntries } from '@/lib/actions/stash-actions';
import { StashList } from '@/components/stash-list';

export default async function StashPage() {
  const entries = await listStashEntries();

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Stash</h1>
      </div>
      <p className="text-gray-500 mb-8">
        Extra content blocks the AI can pull from when tailoring your resume for specific jobs.
      </p>
      <StashList serverEntries={entries} />
    </main>
  );
}
