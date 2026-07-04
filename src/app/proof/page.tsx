import type { Metadata } from 'next';

import { ProofPacketPreview } from '@/components/proof-packet-preview';
import { ProofProjectOverview } from '@/components/proof-project-overview';
import { TrueHireProofPreview } from '@/components/truehire-proof-preview';
import { listAchievementEvidence } from '@/lib/actions/achievement-evidence-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Proof Project',
  description:
    'TrueHire-inspired proof and verification surface for RolePatch application packets, evidence, receipts, and recruiter replies.',
  alternates: { canonical: 'https://rolepatch.com/proof' },
};

export default async function ProofPage() {
  const entries = await listAchievementEvidence();

  return (
    <ProofProjectOverview
      proofPreview={
        <>
          <ProofPacketPreview serverEntries={entries} />
          <TrueHireProofPreview />
        </>
      }
    />
  );
}
