import { getJobApplication, getTailoredResumes } from '@/lib/actions/job-actions';
import { getResume } from '@/lib/actions/resume-actions';
import { notFound } from 'next/navigation';
import { TailorFlow } from '@/components/tailor-flow';

export default async function TailorPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobApplication(jobId);
  if (!job) notFound();

  const resume = await getResume(job.resume_id);
  if (!resume) notFound();

  const tailored = await getTailoredResumes(jobId);

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <div>
          <h1 className="font-semibold">{job.role}</h1>
          <p className="text-sm text-gray-500">{job.company}</p>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">Back</a>
      </header>
      <TailorFlow job={job} resume={resume} existingTailored={tailored} />
    </main>
  );
}
