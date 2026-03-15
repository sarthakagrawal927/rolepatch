'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { localListResumes, localListJobs, localUpdateJobStatus } from '@/lib/local-storage';
import { updateJobStatus } from '@/lib/actions/job-actions';
import type { Resume, JobApplication } from '@/lib/types';
import { CreateResumeButton } from '@/components/create-resume-button';
import { NewJobButton } from '@/components/new-job-button';
import { MigrationBanner } from '@/components/migration-banner';

const STATUS_OPTIONS: JobApplication['status'][] = [
  'draft', 'tailored', 'applied', 'interview', 'offer', 'rejected',
];

const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Draft', dot: 'bg-gray-400', bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-800' },
  tailored: { label: 'Tailored', dot: 'bg-blue-400', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-800' },
  applied: { label: 'Applied', dot: 'bg-amber-400', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-800' },
  interview: { label: 'Interview', dot: 'bg-purple-400', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-800' },
  offer: { label: 'Offer', dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-800' },
  rejected: { label: 'Rejected', dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-800' },
};

interface DashboardProps {
  serverResumes: Resume[];
  serverJobs: JobApplication[];
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Dashboard({ serverResumes, serverJobs }: DashboardProps) {
  const { isGuest } = useAuth();
  const [resumes, setResumes] = useState(serverResumes);
  const [jobs, setJobs] = useState<Pick<JobApplication, 'id' | 'company' | 'role' | 'status' | 'created_at'>[]>(serverJobs);

  // Intentional: hydrate from localStorage for guest users after auth context resolves
  useEffect(() => {
    if (isGuest) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setResumes(localListResumes());
      setJobs(localListJobs());
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isGuest]);

  async function handleStatusChange(jobId: string, newStatus: string) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus as JobApplication['status'] } : j));
    if (isGuest) {
      localUpdateJobStatus(jobId, newStatus as JobApplication['status']);
    } else {
      await updateJobStatus(jobId, newStatus);
    }
  }

  const stats = {
    total: jobs.length,
    active: jobs.filter(j => ['applied', 'interview'].includes(j.status)).length,
    offers: jobs.filter(j => j.status === 'offer').length,
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <MigrationBanner />

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isGuest ? 'Guest mode — sign in to save to the cloud' : 'Your resumes and applications'}
        </p>
      </div>

      {/* Stats bar — only show when there are jobs */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Applications', value: stats.total, accent: 'text-gray-900 dark:text-white' },
            { label: 'Active Pipeline', value: stats.active, accent: 'text-purple-600 dark:text-purple-400' },
            { label: 'Offers', value: stats.offers, accent: 'text-emerald-600 dark:text-emerald-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl px-5 py-4"
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.accent}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resumes section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-blue-500">
                <path d="M3 1h10a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3a2 2 0 012-2zm1 3v2h8V4H4zm0 4v1h8V8H4zm0 3v1h5v-1H4z" fill="currentColor"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Resumes</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{resumes.length}</span>
          </div>
          <CreateResumeButton />
        </div>

        {resumes.length === 0 ? (
          <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-16 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 2v6h6M12 18v-6M9 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No resumes yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create your first resume to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {resumes.map((r) => (
              <Link
                key={r.id}
                href={`/editor/${r.id}`}
                className="group relative border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-md hover:shadow-blue-500/5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {r.name}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      Updated {timeAgo(r.updated_at)}
                    </p>
                  </div>
                  <div className="ml-3 text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                {/* Subtle preview lines */}
                <div className="mt-4 space-y-1.5">
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-4/5" />
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-3/5" />
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full w-2/3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Job Applications section */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-500">
                <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v1H2V4zm0 3h12v5a2 2 0 01-2 2H4a2 2 0 01-2-2V7zm4 2v2h4V9H6z" fill="currentColor"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Job Applications</h2>
            <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{jobs.length}</span>
          </div>
          <NewJobButton resumes={resumes.map(r => ({ id: r.id, name: r.name }))} />
        </div>

        {jobs.length === 0 ? (
          <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-16 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M12 12v4M10 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No applications yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add a job URL to start tailoring your resume</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_140px_100px] gap-4 px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <span>Role</span>
              <span>Company</span>
              <span>Status</span>
              <span className="text-right">Added</span>
            </div>
            {/* Table rows */}
            {jobs.map((job, i) => {
              const cfg = statusConfig[job.status] ?? statusConfig.draft;
              return (
                <Link
                  key={job.id}
                  href={`/tailor/${job.id}`}
                  className={`group grid grid-cols-[1fr_1fr_140px_100px] gap-4 px-5 py-4 items-center hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors ${i < jobs.length - 1 ? 'border-b border-gray-100 dark:border-gray-800/50' : ''}`}
                >
                  <span className="font-medium truncate text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    {job.role || 'Untitled Role'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {job.company || 'Unknown Company'}
                  </span>
                  <div onClick={(e) => e.preventDefault()} onMouseDown={(e) => e.stopPropagation()}>
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value)}
                      className={`text-xs font-medium pl-5 pr-1 py-1 rounded-full border appearance-none cursor-pointer focus:outline-none ${cfg.bg} ${cfg.text} ${cfg.border} relative`}
                      style={{
                        backgroundImage: `radial-gradient(circle 3px, currentColor 3px, transparent 3px)`,
                        backgroundPosition: '8px center',
                        backgroundRepeat: 'no-repeat',
                      }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{statusConfig[s]?.label ?? s}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 text-right">
                    {timeAgo(job.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
