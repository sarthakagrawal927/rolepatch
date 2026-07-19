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

interface TrueHireRoleFitEvidence {
  repo_full_name: string;
  primary_language: string | null;
  commits: number;
  merged_prs: number;
  stars: number;
  matched_signals: string[];
}

export interface TrueHireRoleFitRequirement {
  label: string;
  category: string;
  score: number;
  remediation: string;
  strengths: TrueHireRoleFitEvidence[];
}

export interface TrueHireRoleFitPreview {
  handle: string;
  generated_at: string | null;
  profile_url: string;
  fit_score: number;
  summary: {
    total_requirements: number;
    verified_requirements: number;
    gap_count: number;
    top_languages: string[];
  };
  verified_strengths: TrueHireRoleFitRequirement[];
  gaps: TrueHireRoleFitRequirement[];
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

interface TrueHireRoleFitExport {
  handle?: unknown;
  generatedAt?: unknown;
  report?: {
    fitScore?: unknown;
    summary?: {
      totalRequirements?: unknown;
      verifiedRequirements?: unknown;
      gapCount?: unknown;
      topLanguages?: unknown;
    };
    verifiedStrengths?: unknown;
    gaps?: unknown;
  };
}

interface TrueHireRoleFitResult {
  requirement?: {
    label?: unknown;
    category?: unknown;
  };
  score?: unknown;
  strengths?: unknown;
  remediation?: unknown;
}

interface TrueHireRoleFitRawEvidence {
  repoFullName?: unknown;
  primaryLanguage?: unknown;
  commits?: unknown;
  mergedPrs?: unknown;
  stars?: unknown;
  matchedSignals?: unknown;
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

function trueHireProfileUrl(handle: string, baseUrl = TRUEHIRE_PUBLIC_BASE_URL): string {
  return new URL(`/@${handle}`, ensureTrailingSlash(baseUrl)).toString().replace(/\/$/, '');
}

export function trueHireDataUrl(handle: string, baseUrl = TRUEHIRE_PUBLIC_BASE_URL): string {
  return new URL(`/@${handle}/data.json`, ensureTrailingSlash(baseUrl)).toString();
}

export function trueHireRoleFitUrl(
  handle: string,
  jobDescription: string,
  baseUrl = TRUEHIRE_PUBLIC_BASE_URL
): string {
  const url = new URL(`/@${handle}/role-fit/report.json`, ensureTrailingSlash(baseUrl));
  url.searchParams.set('jd', jobDescription);
  return url.toString();
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

export function mapTrueHireRoleFitExport(
  payload: TrueHireRoleFitExport,
  baseUrl = TRUEHIRE_PUBLIC_BASE_URL
): TrueHireRoleFitPreview {
  const handle = normalizeTrueHireHandle(String(payload.handle ?? '')) ?? 'unknown';
  const report = payload.report ?? {};
  const summary = report.summary ?? {};
  return {
    handle,
    generated_at: typeof payload.generatedAt === 'string' ? payload.generatedAt : null,
    profile_url: trueHireProfileUrl(handle, baseUrl),
    fit_score: toNumber(report.fitScore),
    summary: {
      total_requirements: toNumber(summary.totalRequirements),
      verified_requirements: toNumber(summary.verifiedRequirements),
      gap_count: toNumber(summary.gapCount),
      top_languages: parseUnknownList<string>(summary.topLanguages)
        .filter((item) => typeof item === 'string' && item.trim())
        .slice(0, 4),
    },
    verified_strengths: parseUnknownList<TrueHireRoleFitResult>(report.verifiedStrengths)
      .map(mapRoleFitRequirement)
      .filter((item) => item.label)
      .slice(0, 4),
    gaps: parseUnknownList<TrueHireRoleFitResult>(report.gaps)
      .map(mapRoleFitRequirement)
      .filter((item) => item.label)
      .slice(0, 4),
  };
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

function mapRoleFitRequirement(result: TrueHireRoleFitResult): TrueHireRoleFitRequirement {
  return {
    label: typeof result.requirement?.label === 'string' ? result.requirement.label : '',
    category: typeof result.requirement?.category === 'string' ? result.requirement.category : '',
    score: toNumber(result.score),
    remediation: typeof result.remediation === 'string' ? result.remediation : '',
    strengths: parseUnknownList<TrueHireRoleFitRawEvidence>(result.strengths)
      .map((item) => ({
        repo_full_name: typeof item.repoFullName === 'string' ? item.repoFullName : '',
        primary_language:
          typeof item.primaryLanguage === 'string' && item.primaryLanguage.trim()
            ? item.primaryLanguage
            : null,
        commits: toNumber(item.commits),
        merged_prs: toNumber(item.mergedPrs),
        stars: toNumber(item.stars),
        matched_signals: parseUnknownList<string>(item.matchedSignals)
          .filter((signal) => typeof signal === 'string' && signal.trim())
          .slice(0, 8),
      }))
      .filter((item) => item.repo_full_name)
      .slice(0, 4),
  };
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
