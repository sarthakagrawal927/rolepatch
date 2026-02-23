import { listResumes } from '@/lib/actions/resume-actions';
import { ResumeCard } from '@/components/resume-card';
import { CreateResumeButton } from '@/components/create-resume-button';

export default async function Dashboard() {
  const resumes = await listResumes();

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
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
    </main>
  );
}
