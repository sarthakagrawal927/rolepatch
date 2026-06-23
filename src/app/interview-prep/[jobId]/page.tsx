export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';

import { InterviewPrep } from '@/components/interview-prep';
import { getInterviewStories } from '@/lib/actions/interview-prep-action';
import { getJobApplication } from '@/lib/actions/job-actions';
import { getResume } from '@/lib/actions/resume-actions';

export default async function InterviewPrepPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getJobApplication(jobId);
  if (!job) notFound();

  const resume = await getResume(job.resume_id);
  const stories = await getInterviewStories(jobId);

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <InterviewPrep job={job} resume={resume} existingStories={stories} />
    </main>
  );
}
