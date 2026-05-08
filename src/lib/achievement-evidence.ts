import type { AchievementEvidence } from '@/lib/types';

export function splitEvidenceList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function formatEvidenceBullet(entry: Pick<AchievementEvidence, 'action' | 'result' | 'metric' | 'scope'>): string {
  const action = entry.action.trim();
  const result = entry.result.trim();
  const metric = entry.metric.trim();
  const scope = entry.scope.trim();
  const suffix = [metric, scope].filter(Boolean).join(' across ');
  const sentence = [action, result].filter(Boolean).join(', ');
  if (!sentence) return suffix;
  return suffix ? `${sentence} (${suffix})` : sentence;
}

export function rankEvidenceForRole(entries: AchievementEvidence[], role: string): AchievementEvidence[] {
  const roleText = role.toLowerCase();
  return [...entries].sort((a, b) => scoreEvidence(b, roleText) - scoreEvidence(a, roleText));
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
