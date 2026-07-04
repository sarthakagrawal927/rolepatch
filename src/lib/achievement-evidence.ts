import type { AchievementEvidence } from '@/lib/types';

export type EvidenceQuality = 'strong' | 'usable' | 'weak';
export type ProofReadinessStatus = 'proof_ready' | 'packet_ready' | 'needs_support' | 'needs_claim';

export interface ProofReadiness {
  status: ProofReadinessStatus;
  label: string;
  summary: string;
  missing: string[];
}

export interface ProofPacketPreviewItem {
  id: string;
  title: string;
  claim: string;
  impact: string;
  readiness: ProofReadiness;
  tags: string[];
  source_url?: string;
}

export interface ProofPacketPreview {
  shareable: ProofPacketPreviewItem[];
  needsWork: ProofPacketPreviewItem[];
}

export interface EvidenceMatchReason {
  keywordOverlap: string[];
  skillOverlap: string[];
  roleOverlap: string[];
  metricRelevant: boolean;
}

export function splitEvidenceList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatEvidenceBullet(
  entry: Pick<AchievementEvidence, 'action' | 'result' | 'metric' | 'scope'>
): string {
  const action = entry.action.trim();
  const result = entry.result.trim();
  const metric = entry.metric.trim();
  const scope = entry.scope.trim();
  const suffix = [metric, scope].filter(Boolean).join(' across ');
  const sentence = [action, result].filter(Boolean).join(', ');
  if (!sentence) return suffix;
  return suffix ? `${sentence} (${suffix})` : sentence;
}

export function rankEvidenceForRole(
  entries: AchievementEvidence[],
  role: string
): AchievementEvidence[] {
  const roleText = role.toLowerCase();
  return [...entries].sort((a, b) => scoreEvidence(b, roleText) - scoreEvidence(a, roleText));
}

export function scoreEvidenceQuality(entry: AchievementEvidence): EvidenceQuality {
  const hasOutcome = Boolean(entry.result.trim());
  const hasMetric = Boolean(entry.metric.trim());
  const hasScope = Boolean(entry.scope.trim() || entry.situation.trim());
  const hasAction = Boolean(entry.action.trim());

  if (hasOutcome && hasMetric && hasAction && hasScope) return 'strong';
  if (hasOutcome && hasAction) return 'usable';
  return 'weak';
}

export function proofReadinessForEvidence(entry: AchievementEvidence): ProofReadiness {
  const missing: string[] = [];
  if (!entry.action.trim()) missing.push('action');
  if (!entry.result.trim()) missing.push('outcome');
  if (!entry.metric.trim()) missing.push('metric');
  if (!entry.scope.trim() && !entry.situation.trim()) missing.push('scope or context');
  if (entry.skills.length === 0 && entry.role_targets.length === 0)
    missing.push('skills or role tags');

  const missingCoreClaim = missing.includes('action') || missing.includes('outcome');
  if (missingCoreClaim) {
    return {
      status: 'needs_claim',
      label: 'Needs claim',
      summary: 'Add the action and outcome before this can support a proof packet.',
      missing,
    };
  }

  const missingSupport = missing.some((item) => item === 'metric' || item === 'scope or context');
  if (missingSupport) {
    return {
      status: 'needs_support',
      label: 'Needs support',
      summary: 'Add a metric and context so this reads as credible proof, not a loose claim.',
      missing,
    };
  }

  if (missing.includes('skills or role tags')) {
    return {
      status: 'packet_ready',
      label: 'Packet-ready',
      summary: 'Strong enough for packet review; add tags to improve matching and proof routing.',
      missing,
    };
  }

  return {
    status: 'proof_ready',
    label: 'Proof-ready',
    summary:
      'Ready to preview in proof packets. Still user-provided until external verification ships.',
    missing,
  };
}

export function buildProofPacketPreview(
  entries: AchievementEvidence[],
  limit = 6
): ProofPacketPreview {
  const items = entries.map((entry) => {
    const readiness = proofReadinessForEvidence(entry);
    return {
      id: entry.id,
      title: entry.title,
      claim: formatEvidenceBullet(entry),
      impact: entry.impact_type,
      readiness,
      tags: [...entry.skills, ...entry.role_targets].slice(0, 6),
      source_url: extractEvidenceSourceUrl(entry),
    };
  });

  const shareableStatuses = new Set<ProofReadinessStatus>(['proof_ready', 'packet_ready']);
  return {
    shareable: items
      .filter((item) => shareableStatuses.has(item.readiness.status))
      .sort((a, b) => proofPacketSortScore(b) - proofPacketSortScore(a))
      .slice(0, limit),
    needsWork: items
      .filter((item) => !shareableStatuses.has(item.readiness.status))
      .sort((a, b) => proofPacketSortScore(b) - proofPacketSortScore(a))
      .slice(0, limit),
  };
}

export function buildProofItemsForJob(
  entries: AchievementEvidence[],
  role: string,
  jdText = '',
  limit = 4
): ProofPacketPreviewItem[] {
  const rankedEntries = rankEvidenceForJob(entries, role, jdText);
  return buildProofPacketPreview(rankedEntries, limit).shareable;
}

export function extractEvidenceSourceUrl(
  entry: Pick<AchievementEvidence, 'situation' | 'scope'>
): string | undefined {
  const sourceText = `${entry.situation} ${entry.scope}`;
  const match =
    sourceText.match(/\bSource:\s*(https?:\/\/[^\s)]+)/i) ??
    sourceText.match(/\bhttps?:\/\/[^\s)]+/i);
  if (!match) return undefined;
  try {
    return new URL(match[1] ?? match[0]).toString();
  } catch {
    return undefined;
  }
}

function proofPacketSortScore(item: ProofPacketPreviewItem): number {
  if (item.readiness.status === 'proof_ready') return 4;
  if (item.readiness.status === 'packet_ready') return 3;
  if (item.readiness.status === 'needs_support') return 2;
  return 1;
}

export function explainEvidenceMatch(
  entry: AchievementEvidence,
  role: string,
  jdText = ''
): EvidenceMatchReason {
  const haystack = `${role} ${jdText}`.toLowerCase();
  const keywordOverlap = [...entry.skills, ...entry.role_targets].filter(
    (token) => token && haystack.includes(token.toLowerCase())
  );
  const skillOverlap = entry.skills.filter(
    (skill) => skill && haystack.includes(skill.toLowerCase())
  );
  const roleOverlap = entry.role_targets.filter(
    (target) => target && haystack.includes(target.toLowerCase())
  );
  return {
    keywordOverlap,
    skillOverlap,
    roleOverlap,
    metricRelevant: Boolean(entry.metric.trim()),
  };
}

export function rankEvidenceForJob(
  entries: AchievementEvidence[],
  role: string,
  jdText = ''
): Array<AchievementEvidence & { quality: EvidenceQuality; match: EvidenceMatchReason }> {
  return rankEvidenceForRole(entries, `${role} ${jdText}`).map((entry) => ({
    ...entry,
    quality: scoreEvidenceQuality(entry),
    match: explainEvidenceMatch(entry, role, jdText),
  }));
}

export function formatEvidenceForPrompt(entries: AchievementEvidence[]): string {
  return entries.map((entry) => `- ${entry.title}: ${formatEvidenceBullet(entry)}`).join('\n');
}

function scoreEvidence(entry: AchievementEvidence, roleText: string): number {
  let score = entry.updated_at;
  for (const target of entry.role_targets) {
    if (target && roleText.includes(target.toLowerCase())) score += 1000000000;
  }
  for (const skill of entry.skills) {
    if (skill && roleText.includes(skill.toLowerCase())) score += 500000000;
  }
  if (entry.metric) score += 250000000;
  return score;
}
