import type { AchievementEvidence } from '@/lib/types';

export type EvidenceQuality = 'strong' | 'usable' | 'weak';

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
