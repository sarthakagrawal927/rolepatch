export const dynamic = 'force-dynamic';

import { getJobApplication } from '@/lib/actions/job-actions';
import { getResume } from '@/lib/actions/resume-actions';
import { getCoverLetter } from '@/lib/actions/cover-letter-action';
import { getOutreachEmail } from '@/lib/actions/outreach-action';
import { notFound } from 'next/navigation';
import { CoverLetterEditor } from '@/components/cover-letter-editor';
import { OutreachPanel } from '@/components/outreach-panel';

export default async function CoverLetterPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobApplication(jobId);
  if (!job) notFound();

  const [resume, existing, existingOutreach] = await Promise.all([
    getResume(job.resume_id),
    getCoverLetter(jobId),
    getOutreachEmail(jobId),
  ]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Cover Letter</h1>
        <p className="text-[var(--muted-foreground)]">{job.role} at {job.company}</p>
      </header>
      <CoverLetterEditor job={job} serverResume={resume} existingLetter={existing} />
      <div className="mt-10">
        <OutreachPanel job={job} serverResume={resume} existingEmail={existingOutreach} />
      </div>
    </main>
  );
}
