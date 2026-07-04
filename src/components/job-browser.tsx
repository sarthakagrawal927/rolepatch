'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { JobDiscovery } from '@/components/job-discovery';
import { JobSearchTips } from '@/components/job-search-tips';
import { localListResumes } from '@/lib/local-storage';
import type { Resume } from '@/lib/types';

interface JobBrowserProps {
  serverResumes: Resume[];
}

export function JobBrowser({ serverResumes }: JobBrowserProps) {
  const { isGuest } = useAuth();
  const [resumes, setResumes] = useState(serverResumes);

  useEffect(() => {
    if (isGuest) {
      setResumes(localListResumes());
      return;
    }
    setResumes(serverResumes);
  }, [isGuest, serverResumes]);

  return (
    <div className="space-y-6">
      <JobDiscovery
        resumes={resumes.map((resume) => ({
          id: resume.id,
          name: resume.name,
          source: resume.source,
        }))}
      />
      <JobSearchTips />
    </div>
  );
}
