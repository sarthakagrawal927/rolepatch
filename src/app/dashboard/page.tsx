export const dynamic = 'force-dynamic';

import { listResumes } from '@/lib/actions/resume-actions';
import { listJobApplications } from '@/lib/actions/job-actions';
import { listFitScores } from '@/lib/actions/fit-score-action';
import { Dashboard } from '@/components/dashboard';

export default async function Home() {
  const [resumes, jobs] = await Promise.all([listResumes(), listJobApplications()]);
  const fitScores = await listFitScores(jobs.map((j) => j.id));
  return <Dashboard serverResumes={resumes} serverJobs={jobs} serverFitScores={fitScores} />;
}
