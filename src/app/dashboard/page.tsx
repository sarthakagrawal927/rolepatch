export const dynamic = 'force-dynamic';

import { Dashboard } from '@/components/dashboard';
import { listAchievementEvidence } from '@/lib/actions/achievement-evidence-actions';
import { listFitScores } from '@/lib/actions/fit-score-action';
import { listJobApplications } from '@/lib/actions/job-actions';
import { listResumes } from '@/lib/actions/resume-actions';

export default async function Home() {
  const [resumes, jobs, evidence] = await Promise.all([
    listResumes(),
    listJobApplications(),
    listAchievementEvidence(),
  ]);
  const fitScores = await listFitScores(jobs.map((j) => j.id));
  return (
    <Dashboard
      serverResumes={resumes}
      serverJobs={jobs}
      serverFitScores={fitScores}
      serverEvidence={evidence}
    />
  );
}
