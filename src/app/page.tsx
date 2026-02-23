import { listResumes } from '@/lib/actions/resume-actions';
import { listJobApplications } from '@/lib/actions/job-actions';
import { ResumeCard } from '@/components/resume-card';
import { CreateResumeButton } from '@/components/create-resume-button';
import { NewJobButton } from '@/components/new-job-button';
import Link from 'next/link';

export default async function Dashboard() {
  const resumes = await listResumes();
  const jobs = await listJobApplications();

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      {/* Resumes section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Resumes</h1>
          <CreateResumeButton />
        </div>
        {resumes.length === 0 ? (
          <p className="text-gray-500">No resumes yet. Create one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumes.map((r) => (
              <ResumeCard key={r.id} resume={r} />
            ))}
          </div>
        )}
      </section>

      {/* Job Applications section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Job Applications</h1>
          <NewJobButton resumes={resumes} />
        </div>
        {jobs.length === 0 ? (
          <p className="text-gray-500">No job applications yet. Add one to start tailoring.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/tailor/${job.id}`}
                className="block border rounded-lg p-4 hover:border-green-500 transition-colors"
              >
                <h3 className="font-semibold truncate">{job.role || 'Untitled Role'}</h3>
                <p className="text-sm text-gray-500 mt-1">{job.company || 'Unknown Company'}</p>
                <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {job.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
