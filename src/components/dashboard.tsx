'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { localListResumes, localListJobs, localUpdateJobStatus } from '@/lib/local-storage';
import { updateJobStatus } from '@/lib/actions/job-actions';
import type { Resume, JobApplication } from '@/lib/types';
import { CreateResumeButton } from '@/components/create-resume-button';
import { ResumeImportButton } from '@/components/resume-import-button';
import { NewJobButton } from '@/components/new-job-button';
import { MigrationBanner } from '@/components/migration-banner';
import { ATSScoreMini } from '@/components/ats-score-badge';
import { FitScoreBadge } from '@/components/fit-score-card';
import { FileText, Globe, ArrowRight } from 'lucide-react';

const STATUS_OPTIONS: JobApplication['status'][] = [
  'draft', 'tailored', 'applied', 'interview', 'offer', 'rejected',
];

const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  draft: { label: 'Draft', dot: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-[var(--muted-foreground)]', border: 'border-[var(--border)]' },
  tailored: { label: 'Tailored', dot: 'bg-[var(--primary)]', bg: 'bg-[var(--primary)]/5', text: 'text-[var(--primary)]', border: 'border-[var(--primary)]/20' },
  applied: { label: 'Applied', dot: 'bg-accent', bg: 'bg-accent/5', text: 'text-accent', border: 'border-accent/20' },
  interview: { label: 'Interview', dot: 'bg-accent', bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/30' },
  offer: { label: 'Offer', dot: 'bg-accent', bg: 'bg-accent/20', text: 'text-accent', border: 'border-accent/40' },
  rejected: { label: 'Rejected', dot: 'bg-destructive', bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
};

interface DashboardProps {
  serverResumes: Resume[];
  serverJobs: JobApplication[];
  serverFitScores?: Record<string, number>;
}

function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Dashboard({ serverResumes, serverJobs, serverFitScores }: DashboardProps) {
  const { isGuest } = useAuth();
  const [resumes, setResumes] = useState(serverResumes);
  const [jobs, setJobs] = useState<Pick<JobApplication, 'id' | 'company' | 'role' | 'status' | 'created_at'>[]>(serverJobs);
  const [atsScores, setAtsScores] = useState<Record<string, { original: number; tailored: number }>>({});
  const [fitScores] = useState<Record<string, number>>(serverFitScores ?? {});

  // Intentional: hydrate from localStorage for guest users after auth context resolves
  useEffect(() => {
    if (isGuest) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setResumes(localListResumes());
      setJobs(localListJobs());
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isGuest]);

  // Load cached ATS scores from localStorage
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('rt-ats-scores') ?? '{}');
      if (Object.keys(cached).length > 0) {
        setAtsScores(cached); // eslint-disable-line react-hooks/set-state-in-effect -- hydrate from localStorage
      }
    } catch { /* ignore */ }
  }, []);

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
    <main className="max-w-6xl mx-auto px-6 py-12">
      <MigrationBanner />

      {/* Header */}
      <div className="mb-12">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm font-medium text-[var(--muted-foreground)] mt-2 opacity-80">
          {isGuest ? 'Guest mode — sign in to save to the cloud' : 'Manage your professional assets'}
        </p>
      </div>

      {/* Stats bar — only show when there are jobs */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Total Applications', value: stats.total, accent: 'text-foreground' },
            { label: 'Active Pipeline', value: stats.active, accent: 'text-[var(--primary)]' },
            { label: 'Offers Secured', value: stats.offers, accent: 'text-accent' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--card)] border border-[var(--border)]/50 rounded-2xl px-6 py-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">{stat.label}</p>
              <p className={`text-3xl font-black mt-2 tracking-tight ${stat.accent}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Resumes section */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/5 flex items-center justify-center text-[var(--primary)] shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">Resumes</h2>
              <p className="text-xs font-medium text-[var(--muted-foreground)] opacity-60">Your base documents</p>
            </div>
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] bg-muted px-2.5 py-1 rounded-full">{resumes.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <ResumeImportButton />
            <CreateResumeButton />
          </div>
        </div>

        {resumes.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] rounded-2xl py-20 flex flex-col items-center justify-center bg-muted/20">
            <div className="w-16 h-16 rounded-full bg-background border border-[var(--border)] flex items-center justify-center mb-6 shadow-sm">
              <FileText className="w-8 h-8 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="text-sm font-bold text-foreground">No resumes curated yet</p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-2">Create your primary resume to begin the tailoring process</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumes.map((r) => (
              <Link
                key={r.id}
                href={`/editor/${r.id}`}
                className="group relative bg-[var(--card)] border border-[var(--border)]/60 rounded-2xl p-6 hover:border-[var(--primary)]/40 transition-all hover:shadow-xl hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold truncate text-foreground group-hover:text-[var(--primary)] transition-colors text-lg">
                      {r.name}
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest mt-2 opacity-60">
                      Refined {timeAgo(r.updated_at)}
                    </p>
                  </div>
                  <div className="ml-3 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors group-hover:translate-x-1 duration-200">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
                {/* Subtle preview lines */}
                <div className="mt-6 space-y-2 opacity-20">
                  <div className="h-1 bg-foreground rounded-full w-full" />
                  <div className="h-1 bg-foreground rounded-full w-4/5" />
                  <div className="h-1 bg-foreground rounded-full w-2/3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Job Applications section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">Applications</h2>
              <p className="text-xs font-medium text-[var(--muted-foreground)] opacity-60">Your active job pipeline</p>
            </div>
            <span className="text-[10px] font-bold text-[var(--muted-foreground)] bg-muted px-2.5 py-1 rounded-full">{jobs.length}</span>
          </div>
          <NewJobButton resumes={resumes.map(r => ({ id: r.id, name: r.name }))} />
        </div>

        {jobs.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] rounded-2xl py-20 flex flex-col items-center justify-center bg-muted/20">
            <div className="w-16 h-16 rounded-full bg-background border border-[var(--border)] flex items-center justify-center mb-6 shadow-sm">
              <Globe className="w-8 h-8 text-[var(--muted-foreground)]/30" />
            </div>
            <p className="text-sm font-bold text-foreground">No active applications</p>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mt-2">Add your target job URL to start the AI tailoring engine</p>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)]/60 rounded-2xl overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[1.2fr_1fr_140px_80px_80px_100px] gap-4 px-6 py-4 bg-muted/30 border-b border-[var(--border)] text-[10px] font-black text-[var(--muted-foreground)] uppercase tracking-widest">
              <span>Position</span>
              <span>Organization</span>
              <span>Status</span>
              <span>Fit</span>
              <span>ATS</span>
              <span className="text-right">Initiated</span>
            </div>
            {/* Table rows */}
            {jobs.map((job, i) => {
              const cfg = statusConfig[job.status] ?? statusConfig.draft;
              const ats = atsScores[job.id];
              const fit = fitScores[job.id];
              return (
                <Link
                  key={job.id}
                  href={`/tailor/${job.id}`}
                  className={`group grid grid-cols-[1.2fr_1fr_140px_80px_80px_100px] gap-4 px-6 py-5 items-center hover:bg-muted/10 transition-colors ${i < jobs.length - 1 ? 'border-b border-[var(--border)]/40' : ''}`}
                >
                  <span className="font-bold truncate text-foreground group-hover:text-accent transition-colors">
                    {job.role || 'Untitled Role'}
                  </span>
                  <span className="text-sm font-medium text-[var(--muted-foreground)] truncate opacity-80">
                    {job.company || 'Unknown Company'}
                  </span>
                  <div onClick={(e) => e.preventDefault()} onMouseDown={(e) => e.stopPropagation()}>
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value)}
                      className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border appearance-none cursor-pointer focus:outline-none transition-all ${cfg.bg} ${cfg.text} ${cfg.border} hover:scale-105 active:scale-95`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{statusConfig[s]?.label ?? s}</option>
                      ))}
                    </select>
                  </div>
                  <span className="font-bold">
                    {fit != null ? <FitScoreBadge score={fit} /> : <span className="text-[10px] font-black text-[var(--muted-foreground)] opacity-30">--</span>}
                  </span>
                  <span className="font-bold">
                    {ats ? <ATSScoreMini score={ats.tailored} /> : <span className="text-[10px] font-black text-[var(--muted-foreground)] opacity-30">--</span>}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--muted-foreground)] text-right opacity-60">
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
