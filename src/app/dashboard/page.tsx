export const dynamic = 'force-dynamic';

import { Dashboard } from '@/components/dashboard';
import { listAchievementEvidence } from '@/lib/actions/achievement-evidence-actions';
import {
  listApplicationPackets,
  listApplicationQueue,
  listApplicationReceipts,
} from '@/lib/actions/apply-agent-actions';
import { listFitScores } from '@/lib/actions/fit-score-action';
import { listJobDiscoveryAlerts } from '@/lib/actions/job-discovery-actions';
import { listJobApplications } from '@/lib/actions/job-actions';
import { listProfileAnswers } from '@/lib/actions/profile-answer-actions';
import {
  getReplyRoutingAddress,
  listRecruiterReplyEvents,
} from '@/lib/actions/recruiter-reply-actions';
import { listResumes } from '@/lib/actions/resume-actions';

export default async function Home() {
  const [
    resumes,
    jobs,
    evidence,
    applicationQueue,
    applicationReceipts,
    applicationPackets,
    profileAnswers,
    jobDiscoveryAlerts,
    replyRoutingAddress,
    recruiterReplyEvents,
  ] = await Promise.all([
    listResumes(),
    listJobApplications(),
    listAchievementEvidence(),
    listApplicationQueue(),
    listApplicationReceipts(),
    listApplicationPackets(),
    listProfileAnswers(),
    listJobDiscoveryAlerts(),
    getReplyRoutingAddress(),
    listRecruiterReplyEvents(),
  ]);
  const fitScores = await listFitScores(jobs.map((j) => j.id));
  return (
    <Dashboard
      serverResumes={resumes}
      serverJobs={jobs}
      serverFitScores={fitScores}
      serverEvidence={evidence}
      serverApplicationQueue={applicationQueue}
      serverApplicationReceipts={applicationReceipts}
      serverApplicationPackets={applicationPackets}
      serverProfileAnswers={profileAnswers}
      serverJobDiscoveryAlerts={jobDiscoveryAlerts}
      serverReplyRoutingAddress={replyRoutingAddress}
      serverRecruiterReplyEvents={recruiterReplyEvents}
    />
  );
}
