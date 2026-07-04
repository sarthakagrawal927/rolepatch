import type { Metadata } from 'next';

import { JobBrowser } from '@/components/job-browser';
import { listResumes } from '@/lib/actions/resume-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse Jobs',
  description:
    'Search live job matches, shortlist roles, and queue applications for reviewed RolePatch apply-agent preparation.',
};

export default async function JobsPage() {
  const resumes = await listResumes();

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Job browser
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">
            Find roles and queue reviewed applications.
          </h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Search live openings, save promising matches, and send jobs into packet prep before any
            guarded fill or submit step.
          </p>
        </div>
        <JobBrowser serverResumes={resumes} />
      </div>
    </main>
  );
}
