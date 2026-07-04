export const TRUEHIRE_PUBLIC_BASE_URL = 'https://truehire.sarthakagrawal927.workers.dev';

export interface TrueHireProofProfile {
  handle: string;
  profile_url: string;
  overall_score: number | null;
  signal1_score: number | null;
  signal2_score: number | null;
  last_verified_at: number | null;
  public_work: {
    commits: number;
    repos: number;
    stars: number;
    months_active: number;
  };
  verified_work_entries: number;
}

export interface TrueHireProofItem {
  id: string;
  title: string;
  claim: string;
  source: 'truehire';
  source_label: string;
  source_url: string;
  readiness: string;
  tags: string[];
}

export interface TrueHireProofEvidenceInput {
  title: string;
  situation: string;
  action: string;
  result: string;
  metric: string;
  scope: string;
  skills: string[];
  role_targets: string[];
  impact_type: 'technical' | 'leadership' | 'other';
}

interface TrueHirePublicExport {
  handle?: unknown;
  lastScoredAt?: unknown;
  lastIngestedAt?: unknown;
  score?: {
    overall?: unknown;
    signal1?: unknown;
    signal2?: unknown;
    evidenceJson?: unknown;
    totalCommits?: unknown;
    totalStars?: unknown;
    totalRepos?: unknown;
    monthsActive?: unknown;
  } | null;
  workHistory?: unknown;
}

interface TrueHireEvidenceEntry {
  repoFullName?: unknown;
  stars?: unknown;
  commits?: unknown;
  mergedPrs?: unknown;
  isAuthor?: unknown;
  primaryLanguage?: unknown;
  weight?: unknown;
  craftTags?: unknown;
}

interface TrueHireWorkHistoryEntry {
  company?: unknown;
  title?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
}

export function normalizeTrueHireHandle(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  try {
    const url = new URL(trimmed);
    const allowedHosts = new Set([
      'truehire.sarthakagrawal927.workers.dev',
      'truehire.com',
      'www.truehire.com',
    ]);
    if (!allowedHosts.has(url.hostname)) return null;
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } catch {
    candidate = trimmed;
  }

  const clean = candidate.replace(/^@/, '');
  return /^[a-zA-Z0-9-]{1,39}$/.test(clean) ? clean : null;
}

export function trueHireProfileUrl(handle: string, baseUrl = TRUEHIRE_PUBLIC_BASE_URL): string {
  return new URL(`/@${handle}`, ensureTrailingSlash(baseUrl)).toString().replace(/\/$/, '');
}

export function trueHireDataUrl(handle: string, baseUrl = TRUEHIRE_PUBLIC_BASE_URL): string {
  return new URL(`/@${handle}/data.json`, ensureTrailingSlash(baseUrl)).toString();
}

export function mapTrueHirePublicExportToProof(
  payload: TrueHirePublicExport,
  baseUrl = TRUEHIRE_PUBLIC_BASE_URL
): { profile: TrueHireProofProfile; items: TrueHireProofItem[] } {
  const handle = normalizeTrueHireHandle(String(payload.handle ?? '')) ?? 'unknown';
  const score = payload.score ?? null;
  const evidence = parseJsonList<TrueHireEvidenceEntry>(score?.evidenceJson);
  const workHistory = parseUnknownList<TrueHireWorkHistoryEntry>(payload.workHistory);
  const confirmedWork = workHistory.filter((entry) => String(entry.status ?? '') === 'confirmed');
  const profileUrl = trueHireProfileUrl(handle, baseUrl);

  const profile: TrueHireProofProfile = {
    handle,
    profile_url: profileUrl,
    overall_score: toNullableNumber(score?.overall),
    signal1_score: toNullableNumber(score?.signal1),
    signal2_score: toNullableNumber(score?.signal2),
    last_verified_at: toNullableNumber(payload.lastScoredAt ?? payload.lastIngestedAt),
    public_work: {
      commits: toNumber(score?.totalCommits),
      repos: toNumber(score?.totalRepos),
      stars: toNumber(score?.totalStars),
      months_active: toNumber(score?.monthsActive),
    },
    verified_work_entries: confirmedWork.length,
  };

  const evidenceItems = evidence
    .filter((entry) => typeof entry.repoFullName === 'string' && entry.repoFullName.includes('/'))
    .sort((a, b) => toNumber(b.weight) - toNumber(a.weight))
    .slice(0, 5)
    .map((entry): TrueHireProofItem => {
      const repo = String(entry.repoFullName);
      const commits = toNumber(entry.commits);
      const stars = toNumber(entry.stars);
      const mergedPrs = toNumber(entry.mergedPrs);
      const tags = [
        typeof entry.primaryLanguage === 'string' ? entry.primaryLanguage : '',
        ...parseUnknownList<string>(entry.craftTags),
      ].filter(Boolean);
      return {
        id: `truehire:${handle}:repo:${repo}`,
        title: repo,
        claim: [
          commits > 0 ? `${commits.toLocaleString()} commits` : '',
          mergedPrs > 0 ? `${mergedPrs.toLocaleString()} merged PRs` : '',
          stars > 0 ? `${stars.toLocaleString()} stars` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        source: 'truehire',
        source_label: 'TrueHire public work',
        source_url: `https://github.com/${repo}`,
        readiness: 'Verified public work',
        tags: tags.slice(0, 6),
      };
    });

  const workItems = confirmedWork.slice(0, 3).map((entry, index): TrueHireProofItem => {
    const company = String(entry.company ?? 'Verified employer');
    const title = String(entry.title ?? 'Verified role');
    const start = String(entry.startDate ?? '');
    const end = String(entry.endDate ?? 'present');
    return {
      id: `truehire:${handle}:work:${index}`,
      title: `${title} at ${company}`,
      claim: ['Employer-confirmed work history', [start, end].filter(Boolean).join(' to ')]
        .filter(Boolean)
        .join(' · '),
      source: 'truehire',
      source_label: 'TrueHire employer verification',
      source_url: profileUrl,
      readiness: 'Employer verified',
      tags: ['Signal 2', company].filter(Boolean),
    };
  });

  return { profile, items: [...workItems, ...evidenceItems] };
}

export function trueHireProofItemToEvidenceInput(
  item: TrueHireProofItem,
  profile: TrueHireProofProfile
): TrueHireProofEvidenceInput {
  const isEmployerVerified = item.readiness === 'Employer verified';
  return {
    title: `[TrueHire] ${item.title}`,
    situation: `Imported from TrueHire profile @${profile.handle}. Source: ${item.source_url}`,
    action: item.source_label,
    result: item.claim || item.readiness,
    metric: item.claim,
    scope: `${item.readiness}; TrueHire score ${profile.overall_score ?? 'unscored'}`,
    skills: uniqueList([...item.tags, 'TrueHire']),
    role_targets: uniqueList([
      isEmployerVerified ? 'verified work history' : 'verified public work',
    ]),
    impact_type: isEmployerVerified ? 'leadership' : 'technical',
  };
}

export function trueHireEvidenceDedupeKey(
  input: Pick<TrueHireProofEvidenceInput, 'title' | 'situation'>
) {
  return `${input.title}\n${input.situation}`;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function parseJsonList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string') return [];
  try {
    return parseUnknownList<T>(JSON.parse(value));
  } catch {
    return [];
  }
}

function parseUnknownList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
