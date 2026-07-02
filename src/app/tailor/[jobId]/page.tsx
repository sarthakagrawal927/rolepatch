export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { TailorFlow } from '@/components/tailor-flow';
import { listAchievementEvidence } from '@/lib/actions/achievement-evidence-actions';
import { getFitScore } from '@/lib/actions/fit-score-action';
import { getJobApplication, getTailoredResumes } from '@/lib/actions/job-actions';
import { listResumes } from '@/lib/actions/resume-actions';
import { listStashEntries } from '@/lib/actions/stash-actions';

export default async function TailorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobApplication(jobId);

  const [resumes, tailored, fitScore, stashEntries, evidenceEntries] = await Promise.all([
    listResumes(),
    getTailoredResumes(jobId),
    getFitScore(jobId),
    listStashEntries(),
    listAchievementEvidence(),
  ]);
  const resume = job ? (resumes.find((item) => item.id === job.resume_id) ?? null) : null;

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <div>
          <h1 className="font-semibold">{job?.role ?? 'Tailor resume'}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {job?.company ?? 'Choose a saved profile and project proof'}
          </p>
        </div>
        <Link href="/" className="text-sm text-[var(--muted-foreground)] hover:text-gray-700">
          Back
        </Link>
      </header>
      <TailorFlow
        jobId={jobId}
        job={job}
        serverResume={resume}
        serverResumes={resumes}
        serverStashEntries={stashEntries}
        serverEvidence={evidenceEntries}
        existingTailored={tailored}
        existingFitScore={fitScore}
      />
    </main>
  );
}
