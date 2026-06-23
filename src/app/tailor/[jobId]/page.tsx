export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TailorFlow } from '@/components/tailor-flow';
import { getFitScore } from '@/lib/actions/fit-score-action';
import { getJobApplication, getTailoredResumes } from '@/lib/actions/job-actions';
import { getResume } from '@/lib/actions/resume-actions';

export default async function TailorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobApplication(jobId);
  if (!job) notFound();

  const [resume, tailored, fitScore] = await Promise.all([
    getResume(job.resume_id),
    getTailoredResumes(jobId),
    getFitScore(jobId),
  ]);

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <div>
          <h1 className="font-semibold">{job.role}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{job.company}</p>
        </div>
        <Link href="/" className="text-sm text-[var(--muted-foreground)] hover:text-gray-700">
          Back
        </Link>
      </header>
      <TailorFlow
        job={job}
        serverResume={resume}
        existingTailored={tailored}
        existingFitScore={fitScore}
      />
    </main>
  );
}
