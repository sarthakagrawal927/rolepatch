export const dynamic = 'force-dynamic';

import { listResumes } from '@/lib/actions/resume-actions';
import { listJobApplications } from '@/lib/actions/job-actions';
import { Dashboard } from '@/components/dashboard';

export default async function Home() {
  const [resumes, jobs] = await Promise.all([listResumes(), listJobApplications()]);
  return <Dashboard serverResumes={resumes} serverJobs={jobs} />;
}
