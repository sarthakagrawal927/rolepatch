export const dynamic = 'force-dynamic';

import { AchievementEvidenceBank } from '@/components/achievement-evidence-bank';
import { listAchievementEvidence } from '@/lib/actions/achievement-evidence-actions';

export default async function EvidencePage() {
  const entries = await listAchievementEvidence();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <AchievementEvidenceBank serverEntries={entries} />
    </main>
  );
}
