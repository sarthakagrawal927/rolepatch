'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { localListResumes, localListJobs } from '@/lib/local-storage';
import type { Resume, JobApplication } from '@/lib/types';
import { ResumeCard } from '@/components/resume-card';
import { CreateResumeButton } from '@/components/create-resume-button';
import { NewJobButton } from '@/components/new-job-button';

const statusStyles: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  tailored: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  applied: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

interface DashboardProps {
  serverResumes: Resume[];
  serverJobs: JobApplication[];
}

export function Dashboard({ serverResumes, serverJobs }: DashboardProps) {
  const { isGuest } = useAuth();
  const [resumes, setResumes] = useState(serverResumes);
  const [jobs, setJobs] = useState<Pick<JobApplication, 'id' | 'company' | 'role' | 'status' | 'created_at'>[]>(serverJobs);

  useEffect(() => {
    if (isGuest) {
      setResumes(localListResumes());
      setJobs(localListJobs());
    }
  }, [isGuest]);

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
          <NewJobButton resumes={resumes.map(r => ({ id: r.id, name: r.name }))} />
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
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${statusStyles[job.status] ?? statusStyles.draft}`}>
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
