'use client';

import {
  AlertCircle,
  BarChart3,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { APPLICATION_QUEUE_STATUSES, queueStatusLabel } from '@/lib/apply-agent';
import { failureCodeLabel, getApplyAgentRemediation } from '@/lib/apply-agent-remediation';
import { normalizeJobUrl } from '@/lib/job-discovery-alerts';
import type {
  ApplicationPacket,
  ApplicationQueueEntry,
  ApplicationQueueStatus,
  ApplicationReceipt,
  ApplyAgentDiscoveryAlert,
  ApplyAgentFailureCode,
  JobApplication,
  ProfileAnswer,
  ProfileAnswerCategory,
} from '@/lib/types';

type ApplyAgentJob = Pick<
  JobApplication,
  'id' | 'resume_id' | 'url' | 'company' | 'role' | 'status' | 'updated_at' | 'notes'
>;

type QueueFilter = 'all' | 'ready' | 'needs_user' | 'failed' | 'skipped';

interface ApplyAgentCommandCenterProps {
  jobs: ApplyAgentJob[];
  resumeCount: number;
  fitScores: Record<string, number>;
  queue: ApplicationQueueEntry[];
  receipts: ApplicationReceipt[];
  packets: ApplicationPacket[];
  profileAnswers: ProfileAnswer[];
  discoveryAlerts: ApplyAgentDiscoveryAlert[];
  onQueueApplication: (jobId: string) => Promise<void>;
  onQueueDiscoveryAlert: (alert: ApplyAgentDiscoveryAlert) => Promise<void>;
  onQueueDiscoveryAlerts: (alerts: ApplyAgentDiscoveryAlert[]) => Promise<void>;
  onQueueReadyApplications: () => Promise<void>;
  onRefreshReadiness: () => Promise<void>;
  onUpdateQueueStatus: (queueId: string, status: ApplicationQueueStatus) => Promise<void>;
  onBulkUpdateQueueStatus: (
    queueIds: string[],
    status: Exclude<ApplicationQueueStatus, 'submitted'>
  ) => Promise<void>;
  onRetryQueueEntry: (queueId: string) => Promise<void>;
  onRecordManualReceipt: (queueId: string) => Promise<void>;
  onRunBrowserCheck: (queueId: string) => Promise<void>;
  onRunBrowserCheckBatch: (queueIds: string[]) => Promise<void>;
  onRunGuardedSubmit: (queueId: string) => Promise<void>;
  onRunGuardedSubmitBatch: (queueIds: string[]) => Promise<void>;
  onSaveProfileAnswer: (input: {
    id?: string;
    category: ProfileAnswerCategory;
    label: string;
    answer: string;
    sensitive: boolean;
  }) => Promise<void>;
  onDeleteProfileAnswer: (id: string) => Promise<void>;
}

const PROFILE_CATEGORIES: Array<{ value: ProfileAnswerCategory; label: string }> = [
  { value: 'work_authorization', label: 'Work auth' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'links', label: 'Links' },
  { value: 'location', label: 'Location' },
  { value: 'salary', label: 'Salary' },
  { value: 'open_ended', label: 'Open-ended' },
  { value: 'identity', label: 'Identity' },
  { value: 'other', label: 'Other' },
];

const REQUIRED_ANSWER_CATEGORIES: ProfileAnswerCategory[] = [
  'work_authorization',
  'sponsorship',
  'location',
  'links',
];

type QueueSafetyWarning = {
  id:
    | 'excluded_company'
    | 'duplicate_url'
    | 'low_fit_score'
    | 'company_history'
    | 'required_answers_missing';
  label: string;
  detail: string;
  blocksSubmit: boolean;
  missingCategories?: ProfileAnswerCategory[];
};

const REQUIRED_SAFETY_ANSWER_LABELS: Partial<Record<ProfileAnswerCategory, string>> = {
  work_authorization: 'Authorized to work in this country?',
  sponsorship: 'Need visa sponsorship?',
};
const EXCLUSION_ANSWER_PATTERN =
  /excluded|avoid|do not apply|don't apply|never apply|blocked compan/i;
const MINIMUM_FIT_ANSWER_PATTERN = /minimum fit|fit threshold|minimum score|score threshold/i;
const DAILY_GUARDED_CAP_PATTERN = /daily guarded|daily submit|submit cap|application cap/i;
const DEFAULT_MINIMUM_FIT_SCORE = 70;
const DEFAULT_DAILY_GUARDED_SUBMIT_CAP = 5;

function plural(count: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function profileCategoryLabel(value: ProfileAnswerCategory): string {
  return PROFILE_CATEGORIES.find((category) => category.value === value)?.label ?? value;
}

function isSensitiveAnswer(answer: ProfileAnswer): boolean {
  return answer.sensitive === true || answer.sensitive === 1;
}

function normalizedSafetyTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function splitSafetyList(value: string): string[] {
  return value
    .split(/[,\n;|]+/)
    .map((item) => normalizedSafetyTerm(item))
    .filter((item) => item.length >= 3);
}

function exclusionTermsFromProfileAnswers(profileAnswers: ProfileAnswer[]): string[] {
  const terms = new Set<string>();
  for (const answer of profileAnswers) {
    if (!EXCLUSION_ANSWER_PATTERN.test(`${answer.label} ${answer.answer}`)) continue;
    for (const term of splitSafetyList(answer.answer)) terms.add(term);
  }
  return Array.from(terms);
}

function minimumFitScoreFromProfileAnswer(answer: ProfileAnswer | null): number {
  if (!answer) return DEFAULT_MINIMUM_FIT_SCORE;
  const score = Number(answer.answer.match(/\d+/)?.[0] ?? '');
  if (!Number.isFinite(score)) return DEFAULT_MINIMUM_FIT_SCORE;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function dailyGuardedSubmitCapFromProfileAnswer(answer: ProfileAnswer | null): number {
  if (!answer) return DEFAULT_DAILY_GUARDED_SUBMIT_CAP;
  const cap = Number(answer.answer.match(/\d+/)?.[0] ?? '');
  if (!Number.isFinite(cap)) return DEFAULT_DAILY_GUARDED_SUBMIT_CAP;
  return Math.min(50, Math.max(1, Math.round(cap)));
}

function isSameLocalDay(leftUnix: number, rightUnix: number): boolean {
  return new Date(leftUnix * 1000).toDateString() === new Date(rightUnix * 1000).toDateString();
}

function companyMatchesExclusion(
  company: string | null | undefined,
  terms: string[]
): string | null {
  const normalizedCompany = normalizedSafetyTerm(company ?? '');
  if (!normalizedCompany) return null;
  return (
    terms.find((term) => normalizedCompany.includes(term) || term.includes(normalizedCompany)) ??
    null
  );
}

function missingRequiredSafetyCategories(profileAnswers: ProfileAnswer[]): ProfileAnswerCategory[] {
  const categories = new Set(profileAnswers.map((answer) => answer.category));
  return REQUIRED_ANSWER_CATEGORIES.filter(
    (category) => category === 'work_authorization' || category === 'sponsorship'
  ).filter((category) => !categories.has(category));
}

function safetyWarningsForQueueEntry(input: {
  job: ApplyAgentJob | undefined;
  jobs: ApplyAgentJob[];
  fitScore: number | undefined;
  excludedCompanyTerms: string[];
  missingSafetyCategories: ProfileAnswerCategory[];
  minimumFitScore: number;
  normalizedUrlCounts: Map<string, number>;
}): QueueSafetyWarning[] {
  const warnings: QueueSafetyWarning[] = [];
  if (input.missingSafetyCategories.length > 0) {
    warnings.push({
      id: 'required_answers_missing',
      label: 'Required answers missing',
      detail: `Add ${input.missingSafetyCategories.map(profileCategoryLabel).join(' and ')} answers before guarded submit.`,
      blocksSubmit: true,
      missingCategories: input.missingSafetyCategories,
    });
  }

  const excludedTerm = companyMatchesExclusion(input.job?.company, input.excludedCompanyTerms);
  if (excludedTerm) {
    warnings.push({
      id: 'excluded_company',
      label: 'Excluded company',
      detail: `Matches saved exclusion "${excludedTerm}". Skip or edit the safety answer before submitting.`,
      blocksSubmit: true,
    });
  }

  if (input.job?.url) {
    const normalizedUrl = normalizeJobUrl(input.job.url);
    if ((input.normalizedUrlCounts.get(normalizedUrl) ?? 0) > 1) {
      warnings.push({
        id: 'duplicate_url',
        label: 'Duplicate job URL',
        detail: 'Another tracked job uses the same ATS URL. Review duplicates before submitting.',
        blocksSubmit: true,
      });
    }
  }

  const normalizedCompany = normalizedSafetyTerm(input.job?.company ?? '');
  const companyHistory = normalizedCompany
    ? input.jobs.filter(
        (job) =>
          job.id !== input.job?.id &&
          normalizedSafetyTerm(job.company ?? '') === normalizedCompany &&
          ['applied', 'interview', 'offer', 'rejected'].includes(job.status)
      )
    : [];
  if (companyHistory.length > 0) {
    const statusSummary = Array.from(new Set(companyHistory.map((job) => job.status))).join(', ');
    warnings.push({
      id: 'company_history',
      label: 'Company history',
      detail: `Already tracking ${companyHistory.length} submitted-stage ${companyHistory.length === 1 ? 'role' : 'roles'} at this company (${statusSummary}). Review history before submitting another application.`,
      blocksSubmit: false,
    });
  }

  if (typeof input.fitScore === 'number' && input.fitScore < input.minimumFitScore) {
    warnings.push({
      id: 'low_fit_score',
      label: 'Low fit confidence',
      detail: `Fit score is ${input.fitScore}; minimum is ${input.minimumFitScore}. Tailor or skip before guarded submit.`,
      blocksSubmit: true,
    });
  }

  return warnings;
}

const SEMANTIC_DISCOVERY_NOTE_PATTERN =
  /RolePatch semantic match:\s*(\d+)% resume match\.(?:\s*Evidence:\s*([^.\n]+)\.)?/i;
const DISCOVERY_ALERT_NOTE_PATTERN = /RolePatch discovery alert(?::\s*([^.\n]+))?\./i;

function parseSemanticDiscoveryNote(note?: string | null): {
  score: number;
  evidence: string[];
  remainingNote: string;
} | null {
  if (!note) return null;
  const match = note.match(SEMANTIC_DISCOVERY_NOTE_PATTERN);
  if (!match) return null;
  const evidence = match[2]
    ? match[2]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  return {
    score: Number(match[1]),
    evidence,
    remainingNote: note.replace(match[0], '').trim(),
  };
}

function parseDiscoveryAlertNote(note?: string | null): {
  source: string;
  location?: string;
  remainingNote: string;
} | null {
  if (!note) return null;
  const match = note.match(DISCOVERY_ALERT_NOTE_PATTERN);
  if (!match) return null;
  const parts = (match[1] ?? '')
    .split('·')
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    source: parts[0] ?? 'Discovery alert',
    location: parts[1],
    remainingNote: note.replace(match[0], '').trim(),
  };
}

function parseRolePatchQueueNoteRemainder(note?: string | null): string {
  if (!note) return '';
  return note
    .replace(SEMANTIC_DISCOVERY_NOTE_PATTERN, '')
    .replace(DISCOVERY_ALERT_NOTE_PATTERN, '')
    .trim();
}

const FAILURE_CODE_SET: Record<ApplyAgentFailureCode, true> = {
  provider_unsupported: true,
  captcha_detected: true,
  file_upload_required: true,
  missing_required_fields: true,
  submit_button_missing: true,
  form_not_found: true,
  browser_unavailable: true,
  browser_navigation_failed: true,
  confirmation_missing: true,
  runtime_failure: true,
};

function receiptFailureCode(receipt: ApplicationReceipt | undefined): ApplyAgentFailureCode | null {
  const value = receipt?.fields.find(
    (field) => field.label.toLowerCase() === 'failure code'
  )?.value;
  if (!value || value === 'none') return null;
  return value in FAILURE_CODE_SET ? (value as ApplyAgentFailureCode) : null;
}

function receiptFieldValue(receipt: ApplicationReceipt, label: string): string | null {
  return (
    receipt.fields.find((field) => field.label.toLowerCase() === label.toLowerCase())?.value ?? null
  );
}

function extractMissingRequiredLabels(receipt: ApplicationReceipt): string[] {
  const labels: string[] = [];
  const seenLabels = new Set<string>();
  const addLabel = (label: string) => {
    const normalized = label.trim().replace(/\s+/g, ' ');
    const key = normalized.toLowerCase();
    if (normalized.length <= 1 || key === 'none' || seenLabels.has(key)) return;
    seenLabels.add(key);
    labels.push(normalized);
  };

  for (const label of splitReceiptList(receiptFieldValue(receipt, 'Missing answer fields'))) {
    addLabel(label);
  }

  const sources = [
    receiptFieldValue(receipt, 'Blocked reasons'),
    receipt.failure_reason,
    receipt.confirmation_text,
  ].filter((value): value is string => Boolean(value));
  for (const source of sources) {
    const match = source.match(/required fields? (?:are )?empty:\s*([^|.]+)/i);
    if (!match?.[1]) continue;
    for (const label of match[1].split(',')) addLabel(label);
  }
  return labels;
}

function splitReceiptList(value: string | null): string[] {
  if (!value || /^(none|none detected)$/i.test(value.trim())) return [];
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function numericReceiptField(receipt: ApplicationReceipt, label: string): number | null {
  const value = receiptFieldValue(receipt, label);
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function receiptSummary(receipt: ApplicationReceipt) {
  const answeredFields =
    numericReceiptField(receipt, 'Filled fields') ??
    receipt.fields.filter((field) => field.source !== 'system').length;
  const skippedFields = numericReceiptField(receipt, 'Skipped fields') ?? 0;
  const uploadedFiles = splitReceiptList(receiptFieldValue(receipt, 'Files uploaded by extension'));
  const manualUploads = splitReceiptList(receiptFieldValue(receipt, 'Manual file uploads needed'));
  const blockers = splitReceiptList(receiptFieldValue(receipt, 'Blocked reasons'));
  const proofCandidates = receipt.fields.filter((field) => field.label === 'Proof candidate');
  return {
    answeredFields,
    skippedFields,
    uploadedFiles: uploadedFiles.length,
    manualUploads: manualUploads.length,
    blockers: blockers.filter((blocker) => !/^none$/i.test(blocker)).length,
    proofCandidates: proofCandidates.length,
    hasConfirmation: Boolean(receipt.confirmation_url || receipt.confirmation_text),
  };
}

function formatReceiptAuditSummary(receipt: ApplicationReceipt, job: ApplyAgentJob | undefined) {
  const lines = [
    'RolePatch application receipt',
    `Role: ${job?.role || 'Unknown role'}`,
    `Company: ${job?.company || 'Unknown company'}`,
    `ATS URL: ${job?.url || 'Not captured'}`,
    `Provider: ${receipt.provider || 'unknown'}`,
    `Status: ${receipt.status}`,
    `Created: ${formatReceiptTime(receipt.created_at)}`,
  ];

  if (receipt.confirmation_url) lines.push(`Confirmation URL: ${receipt.confirmation_url}`);
  if (receipt.confirmation_text) lines.push(`Confirmation: ${receipt.confirmation_text}`);
  if (receipt.failure_reason) lines.push(`Failure reason: ${receipt.failure_reason}`);

  lines.push('', 'Captured fields:');
  if (receipt.fields.length === 0) {
    lines.push('- None captured');
  } else {
    for (const field of receipt.fields) {
      lines.push(`- ${field.label} [${field.source}]: ${field.value || 'No value captured'}`);
    }
  }

  return lines.join('\n');
}

function formatProofPacketSummary(packet: ApplicationPacket, job: ApplyAgentJob | undefined) {
  const proofItems = packet.proof_items ?? [];
  const lines = [
    'RolePatch proof packet',
    `Role: ${job?.role || 'Unknown role'}`,
    `Company: ${job?.company || 'Unknown company'}`,
    `ATS URL: ${packet.ats_url || job?.url || 'Not captured'}`,
    '',
    'Boundary: These proof points are user-reviewed context. RolePatch does not automatically share them with employers.',
    '',
    'Proof points:',
  ];

  if (proofItems.length === 0) {
    lines.push('- None available');
  } else {
    for (const item of proofItems) {
      lines.push(`- ${item.title} [${item.readiness}]: ${item.claim}`);
      if (item.tags.length > 0) lines.push(`  Tags: ${item.tags.join(', ')}`);
      if (item.missing.length > 0) lines.push(`  Missing: ${item.missing.join(', ')}`);
      if (item.source_url) lines.push(`  Source: ${item.source_url}`);
    }
  }

  return lines.join('\n');
}

function formatReceiptTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function readinessMaterialChecklist(entry: ApplicationQueueEntry) {
  return [
    {
      key: 'resume',
      label: 'Base resume',
      ready: entry.readiness.checks.resume,
      next: 'select resume',
    },
    {
      key: 'tailored_resume',
      label: 'Tailored resume',
      ready: entry.readiness.checks.tailored_resume,
      next: 'tailor role',
    },
    {
      key: 'cover_letter',
      label: 'Cover letter',
      ready: entry.readiness.checks.cover_letter,
      next: 'generate letter',
    },
    {
      key: 'profile_answers',
      label: 'Profile answers',
      ready: entry.readiness.checks.profile_answers,
      next: 'add answers',
    },
    {
      key: 'receipt',
      label: 'Receipt',
      ready: entry.readiness.checks.receipt,
      next: 'after submit',
    },
  ];
}

export function ApplyAgentCommandCenter({
  jobs,
  resumeCount,
  fitScores,
  queue,
  receipts,
  packets,
  profileAnswers,
  discoveryAlerts,
  onQueueApplication,
  onQueueDiscoveryAlert,
  onQueueDiscoveryAlerts,
  onQueueReadyApplications,
  onRefreshReadiness,
  onUpdateQueueStatus,
  onBulkUpdateQueueStatus,
  onRetryQueueEntry,
  onRecordManualReceipt,
  onRunBrowserCheck,
  onRunBrowserCheckBatch,
  onRunGuardedSubmit,
  onRunGuardedSubmitBatch,
  onSaveProfileAnswer,
  onDeleteProfileAnswer,
}: ApplyAgentCommandCenterProps) {
  const [profileCategory, setProfileCategory] =
    useState<ProfileAnswerCategory>('work_authorization');
  const [editingProfileAnswerId, setEditingProfileAnswerId] = useState<string | null>(null);
  const [profileLabel, setProfileLabel] = useState('Authorized to work in US?');
  const [profileAnswer, setProfileAnswer] = useState('');
  const [profileSensitive, setProfileSensitive] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [packetJobId, setPacketJobId] = useState<string | null>(null);
  const [receiptDetailId, setReceiptDetailId] = useState<string | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);
  const [copiedProofPacketJobId, setCopiedProofPacketJobId] = useState<string | null>(null);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(() => new Set());
  const [checkingQueueId, setCheckingQueueId] = useState<string | null>(null);
  const [checkingBatch, setCheckingBatch] = useState(false);
  const [submittingQueueId, setSubmittingQueueId] = useState<string | null>(null);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [queueingDiscoveryAlerts, setQueueingDiscoveryAlerts] = useState(false);
  const [browserCheckError, setBrowserCheckError] = useState<string | null>(null);
  const summary = useMemo(() => {
    const tailored = jobs.filter((job) => job.status === 'tailored');
    const drafts = jobs.filter((job) => job.status === 'draft');
    const submitted = jobs.filter((job) =>
      ['applied', 'interview', 'offer', 'rejected'].includes(job.status)
    );
    const ready = tailored.slice().sort((a, b) => b.updated_at - a.updated_at);
    const nextReady = ready[0];

    return {
      drafts: drafts.length,
      ready: ready.length,
      submitted: submitted.length,
      nextReady,
    };
  }, [jobs]);

  const nextStep =
    resumeCount === 0
      ? 'Create a base resume before building an application queue.'
      : jobs.length === 0
        ? 'Add job URLs or run a saved search to build your queue.'
        : summary.ready > 0
          ? `Review ${summary.nextReady?.role || 'the next tailored role'} at ${summary.nextReady?.company || 'the target company'} before submitting.`
          : summary.drafts > 0
            ? 'Tailor draft jobs first so the queue has reviewed materials.'
            : 'Keep adding high-fit roles, then review receipts as applications move forward.';

  const queuedJobIds = useMemo(() => new Set(queue.map((entry) => entry.job_id)), [queue]);
  const queuedJobUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const job of jobs) {
      if (!job.url || !queuedJobIds.has(job.id)) continue;
      urls.add(normalizeJobUrl(job.url));
    }
    return urls;
  }, [jobs, queuedJobIds]);
  const receiptsByJob = useMemo(() => {
    const map = new Map<string, ApplicationReceipt>();
    for (const receipt of receipts) {
      if (!map.has(receipt.job_id)) map.set(receipt.job_id, receipt);
    }
    return map;
  }, [receipts]);
  const receiptHistoryByJob = useMemo(() => {
    const map = new Map<string, ApplicationReceipt[]>();
    for (const receipt of receipts) {
      const history = map.get(receipt.job_id) ?? [];
      history.push(receipt);
      map.set(receipt.job_id, history);
    }
    for (const history of map.values()) {
      history.sort((a, b) => b.created_at - a.created_at);
    }
    return map;
  }, [receipts]);
  const automationHealth = useMemo(() => {
    const browserReceipts = receipts.filter((receipt) =>
      Boolean(receiptFieldValue(receipt, 'Browser runner mode'))
    );
    const submitReceipts = browserReceipts.filter((receipt) =>
      /guarded browser submit/i.test(receiptFieldValue(receipt, 'Browser runner mode') ?? '')
    );
    const providerMap = new Map<
      string,
      {
        provider: string;
        attempts: number;
        submitted: number;
        blocked: number;
        successRate: number;
        blockedRate: number;
        recommendation: string;
      }
    >();
    const failureMap = new Map<
      ApplyAgentFailureCode,
      { count: number; providers: Map<string, number> }
    >();

    for (const receipt of browserReceipts) {
      const provider = receipt.provider || 'unknown';
      const current = providerMap.get(provider) ?? {
        provider,
        attempts: 0,
        submitted: 0,
        blocked: 0,
        successRate: 0,
        blockedRate: 0,
        recommendation: 'Collect more receipts',
      };
      current.attempts += 1;
      if (receipt.status === 'submitted') current.submitted += 1;
      if (receipt.status === 'failed' || receipt.status === 'skipped') current.blocked += 1;
      providerMap.set(provider, current);

      const failureCode = receiptFailureCode(receipt);
      if (failureCode) {
        const failure = failureMap.get(failureCode) ?? { count: 0, providers: new Map() };
        failure.count += 1;
        failure.providers.set(provider, (failure.providers.get(provider) ?? 0) + 1);
        failureMap.set(failureCode, failure);
      }
    }

    const submitSuccesses = submitReceipts.filter(
      (receipt) => receipt.status === 'submitted'
    ).length;
    const providers = Array.from(providerMap.values()).map((provider) => {
      const successRate =
        provider.attempts > 0 ? Math.round((provider.submitted / provider.attempts) * 100) : 0;
      const blockedRate =
        provider.attempts > 0 ? Math.round((provider.blocked / provider.attempts) * 100) : 0;
      const recommendation =
        provider.attempts >= 5 && provider.submitted >= 3 && blockedRate <= 25
          ? 'Ready for deeper automation'
          : provider.attempts >= 3 && blockedRate >= 50
            ? 'Fix blockers first'
            : 'Collect more receipts';
      return { ...provider, successRate, blockedRate, recommendation };
    });

    return {
      browserReceipts: browserReceipts.length,
      submitAttempts: submitReceipts.length,
      submitSuccesses,
      providers: providers.sort((a, b) => b.attempts - a.attempts || b.submitted - a.submitted),
      failures: Array.from(failureMap.entries())
        .map(([code, failure]) => ({
          code,
          count: failure.count,
          provider:
            Array.from(failure.providers.entries()).sort(
              (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
            )[0]?.[0] ?? null,
        }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)),
    };
  }, [receipts]);
  const packetsByJob = useMemo(
    () => new Map(packets.map((packet) => [packet.job_id, packet])),
    [packets]
  );
  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const normalizedJobUrlCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      if (!job.url) continue;
      const normalized = normalizeJobUrl(job.url);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return counts;
  }, [jobs]);
  const excludedCompanyTerms = useMemo(
    () => exclusionTermsFromProfileAnswers(profileAnswers),
    [profileAnswers]
  );
  const exclusionProfileAnswer = useMemo(
    () =>
      profileAnswers.find((answer) =>
        EXCLUSION_ANSWER_PATTERN.test(`${answer.label} ${answer.answer}`)
      ) ?? null,
    [profileAnswers]
  );
  const minimumFitProfileAnswer = useMemo(
    () =>
      profileAnswers.find((answer) =>
        MINIMUM_FIT_ANSWER_PATTERN.test(`${answer.label} ${answer.answer}`)
      ) ?? null,
    [profileAnswers]
  );
  const minimumFitScore = useMemo(
    () => minimumFitScoreFromProfileAnswer(minimumFitProfileAnswer),
    [minimumFitProfileAnswer]
  );
  const dailyGuardedCapProfileAnswer = useMemo(
    () =>
      profileAnswers.find((answer) =>
        DAILY_GUARDED_CAP_PATTERN.test(`${answer.label} ${answer.answer}`)
      ) ?? null,
    [profileAnswers]
  );
  const dailyGuardedSubmitCap = useMemo(
    () => dailyGuardedSubmitCapFromProfileAnswer(dailyGuardedCapProfileAnswer),
    [dailyGuardedCapProfileAnswer]
  );
  const guardedSubmitsToday = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return receipts.filter(
      (receipt) =>
        receipt.status === 'submitted' &&
        /guarded browser submit/i.test(receiptFieldValue(receipt, 'Browser runner mode') ?? '') &&
        isSameLocalDay(receipt.created_at, now)
    ).length;
  }, [receipts]);
  const remainingGuardedSubmitsToday = Math.max(0, dailyGuardedSubmitCap - guardedSubmitsToday);
  const missingSafetyCategories = useMemo(
    () => missingRequiredSafetyCategories(profileAnswers),
    [profileAnswers]
  );
  const queueSafetyWarnings = useMemo(() => {
    const map = new Map<string, QueueSafetyWarning[]>();
    for (const entry of queue) {
      const job = jobsById.get(entry.job_id);
      map.set(
        entry.id,
        safetyWarningsForQueueEntry({
          job,
          jobs,
          fitScore: job ? fitScores[job.id] : undefined,
          excludedCompanyTerms,
          missingSafetyCategories,
          minimumFitScore,
          normalizedUrlCounts: normalizedJobUrlCounts,
        })
      );
    }
    return map;
  }, [
    excludedCompanyTerms,
    fitScores,
    jobs,
    jobsById,
    missingSafetyCategories,
    minimumFitScore,
    normalizedJobUrlCounts,
    queue,
  ]);
  const queueSafetySummary = useMemo(() => {
    let blockedEntries = 0;
    let warningEntries = 0;
    let totalWarnings = 0;
    for (const warnings of queueSafetyWarnings.values()) {
      if (warnings.length === 0) continue;
      warningEntries += 1;
      totalWarnings += warnings.length;
      if (warnings.some((warning) => warning.blocksSubmit)) blockedEntries += 1;
    }

    return {
      blockedEntries,
      warningEntries,
      totalWarnings,
      cleanEntries: Math.max(0, queue.length - warningEntries),
    };
  }, [queue.length, queueSafetyWarnings]);
  const applyModeReadiness = useMemo(() => {
    const cleanReadyEntries = queue.filter(
      (entry) =>
        entry.status === 'ready_to_submit' &&
        !(queueSafetyWarnings.get(entry.id) ?? []).some((warning) => warning.blocksSubmit)
    ).length;
    const automationCandidates = automationHealth.providers.filter(
      (provider) => provider.recommendation === 'Ready for deeper automation'
    );
    const strongestProvider = automationCandidates[0]?.provider;

    return [
      {
        label: 'Review mode',
        state: 'Live',
        detail: `${plural(queue.length, 'queued application')} can stay in packet, status, and receipt review.`,
      },
      {
        label: 'Assisted fill',
        state: profileAnswers.length > 0 ? 'Ready' : 'Needs answers',
        detail:
          profileAnswers.length > 0
            ? `${plural(profileAnswers.length, 'saved answer')} available for extension fill.`
            : 'Add profile answers before extension fill can do useful work.',
      },
      {
        label: 'Guarded submit',
        state:
          cleanReadyEntries > 0
            ? 'Ready'
            : queueSafetySummary.blockedEntries > 0
              ? 'Blocked'
              : 'Collect evidence',
        detail:
          cleanReadyEntries > 0
            ? `${plural(cleanReadyEntries, 'ready entry', 'ready entries')} can run guarded submit after confirmation.`
            : queueSafetySummary.blockedEntries > 0
              ? `${plural(queueSafetySummary.blockedEntries, 'entry', 'entries')} blocked by safety review.`
              : 'Run reviewed browser checks and collect receipts before relying on guarded submit.',
      },
      {
        label: 'Unattended apply',
        state: 'Locked',
        detail: strongestProvider
          ? `${strongestProvider} has candidate evidence for deeper design, but unattended apply stays locked.`
          : 'Needs repeated clean receipts, provider-specific design, and explicit user approval before it can ship.',
      },
    ];
  }, [
    automationHealth.providers,
    profileAnswers.length,
    queue,
    queueSafetySummary.blockedEntries,
    queueSafetyWarnings,
  ]);
  const queueableReadyCount = jobs.filter(
    (job) => job.status === 'tailored' && !queuedJobIds.has(job.id)
  ).length;
  const matchFeed = useMemo(() => {
    const statusBoost: Record<JobApplication['status'], number> = {
      tailored: 15,
      draft: 5,
      applied: -20,
      interview: -30,
      offer: -40,
      rejected: -80,
    };
    return jobs
      .map((job) => ({
        job,
        fit: fitScores[job.id],
        score: (fitScores[job.id] ?? 50) + statusBoost[job.status],
      }))
      .filter((item) => !['offer', 'rejected'].includes(item.job.status))
      .sort((a, b) => b.score - a.score || b.job.updated_at - a.job.updated_at)
      .slice(0, 5);
  }, [fitScores, jobs]);
  const actionableDiscoveryAlerts = useMemo(
    () =>
      discoveryAlerts
        .filter((alert) => Boolean(alert.job_url))
        .sort(
          (a, b) => Number(Boolean(a.seen)) - Number(Boolean(b.seen)) || b.created_at - a.created_at
        )
        .slice(0, 4),
    [discoveryAlerts]
  );
  const queueableDiscoveryAlerts = useMemo(
    () =>
      actionableDiscoveryAlerts.filter(
        (alert) => alert.job_url && !queuedJobUrls.has(normalizeJobUrl(alert.job_url))
      ),
    [actionableDiscoveryAlerts, queuedJobUrls]
  );
  const answerGapPrompts = useMemo(() => {
    const existingLabels = new Set(profileAnswers.map((answer) => answer.label.toLowerCase()));
    const prompts = new Map<
      string,
      { label: string; provider: string; jobLabel: string; receiptId: string }
    >();
    for (const receipt of receipts) {
      if (receiptFailureCode(receipt) !== 'missing_required_fields') continue;
      const job = jobsById.get(receipt.job_id);
      for (const label of extractMissingRequiredLabels(receipt)) {
        const key = label.toLowerCase();
        if (existingLabels.has(key) || prompts.has(key)) continue;
        prompts.set(key, {
          label,
          provider: receipt.provider || 'unknown provider',
          jobLabel: job
            ? `${job.role || 'Queued role'} at ${job.company || 'Unknown company'}`
            : 'queued role',
          receiptId: receipt.id,
        });
      }
    }
    return Array.from(prompts.values()).slice(0, 6);
  }, [jobsById, profileAnswers, receipts]);
  const filteredQueue = useMemo(() => {
    if (queueFilter === 'all') return queue;
    if (queueFilter === 'ready') {
      return queue.filter(
        (entry) =>
          entry.status === 'ready_to_submit' || entry.readiness.status === 'ready_for_review'
      );
    }
    return queue.filter((entry) => entry.status === queueFilter);
  }, [queue, queueFilter]);
  const visibleQueueIds = useMemo(
    () => filteredQueue.slice(0, 8).map((entry) => entry.id),
    [filteredQueue]
  );
  const selectedVisibleCount = visibleQueueIds.filter((id) => selectedQueueIds.has(id)).length;
  const selectedQueueCount = selectedQueueIds.size;
  const allVisibleSelected =
    visibleQueueIds.length > 0 && selectedVisibleCount === visibleQueueIds.length;

  const readiness = [
    { label: 'Needs tailoring', value: summary.drafts, icon: Sparkles },
    { label: 'Ready for review', value: summary.ready, icon: FileCheck2 },
    { label: 'Submitted / tracked', value: summary.submitted, icon: ClipboardCheck },
  ];

  const roadmap = [
    { label: 'Resume and cover letter prep', state: 'Live' },
    { label: 'Application queue states', state: 'Live' },
    { label: 'Profile answers', state: profileAnswers.length > 0 ? 'Live' : 'Needed' },
    { label: 'Reviewed browser check', state: 'Live' },
    { label: 'Guarded browser submit', state: 'Live' },
    { label: 'Bulk unattended apply', state: 'Planned' },
    { label: 'Manual receipts', state: 'Live' },
  ];
  const answerBankReview = useMemo(() => {
    const categories = new Set(profileAnswers.map((answer) => answer.category));
    const missingCategories = REQUIRED_ANSWER_CATEGORIES.filter(
      (category) => !categories.has(category)
    );
    const sensitiveCount = profileAnswers.filter(isSensitiveAnswer).length;
    const latestUpdatedAt = profileAnswers.reduce(
      (latest, answer) => Math.max(latest, answer.updated_at || answer.created_at || 0),
      0
    );

    return {
      missingCategories,
      sensitiveCount,
      readyCategoryCount: REQUIRED_ANSWER_CATEGORIES.length - missingCategories.length,
      latestUpdatedAt,
    };
  }, [profileAnswers]);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileLabel.trim() || !profileAnswer.trim()) return;
    setSavingProfile(true);
    try {
      await onSaveProfileAnswer({
        id: editingProfileAnswerId ?? undefined,
        category: profileCategory,
        label: profileLabel,
        answer: profileAnswer,
        sensitive: profileSensitive,
      });
      setEditingProfileAnswerId(null);
      setProfileAnswer('');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleAnswerGapPrompt(label: string) {
    setEditingProfileAnswerId(null);
    setProfileCategory('open_ended');
    setProfileLabel(label);
    setProfileAnswer('');
    setProfileSensitive(true);
  }

  function handleRequiredSafetyAnswerPrompt(category: ProfileAnswerCategory) {
    setEditingProfileAnswerId(null);
    setProfileCategory(category);
    setProfileLabel(REQUIRED_SAFETY_ANSWER_LABELS[category] ?? profileCategoryLabel(category));
    setProfileAnswer('');
    setProfileSensitive(true);
  }

  function handleExcludedCompaniesPrompt() {
    setEditingProfileAnswerId(exclusionProfileAnswer?.id ?? null);
    setProfileCategory('other');
    setProfileLabel(exclusionProfileAnswer?.label ?? 'Excluded companies');
    setProfileAnswer(exclusionProfileAnswer?.answer ?? '');
    setProfileSensitive(true);
  }

  function handleMinimumFitPrompt() {
    setEditingProfileAnswerId(minimumFitProfileAnswer?.id ?? null);
    setProfileCategory('other');
    setProfileLabel(minimumFitProfileAnswer?.label ?? 'Minimum fit score');
    setProfileAnswer(minimumFitProfileAnswer?.answer ?? String(DEFAULT_MINIMUM_FIT_SCORE));
    setProfileSensitive(true);
  }

  function handleDailyGuardedCapPrompt() {
    setEditingProfileAnswerId(dailyGuardedCapProfileAnswer?.id ?? null);
    setProfileCategory('other');
    setProfileLabel(dailyGuardedCapProfileAnswer?.label ?? 'Daily guarded submit cap');
    setProfileAnswer(
      dailyGuardedCapProfileAnswer?.answer ?? String(DEFAULT_DAILY_GUARDED_SUBMIT_CAP)
    );
    setProfileSensitive(true);
  }

  function handleEditProfileAnswer(answer: ProfileAnswer) {
    setEditingProfileAnswerId(answer.id);
    setProfileCategory(answer.category);
    setProfileLabel(answer.label);
    setProfileAnswer(answer.answer);
    setProfileSensitive(isSensitiveAnswer(answer));
  }

  function handleCancelProfileEdit() {
    setEditingProfileAnswerId(null);
    setProfileAnswer('');
  }

  function toggleQueueSelection(queueId: string) {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (next.has(queueId)) next.delete(queueId);
      else next.add(queueId);
      return next;
    });
  }

  function toggleVisibleQueueSelection() {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleQueueIds) next.delete(id);
      } else {
        for (const id of visibleQueueIds) next.add(id);
      }
      return next;
    });
  }

  async function handleBulkStatus(status: Exclude<ApplicationQueueStatus, 'submitted'>) {
    const queueIds = Array.from(selectedQueueIds);
    if (queueIds.length === 0) return;
    await onBulkUpdateQueueStatus(queueIds, status);
    setSelectedQueueIds(new Set());
  }

  async function handleQueueDiscoveryAlertBatch() {
    if (queueableDiscoveryAlerts.length === 0) return;
    setQueueingDiscoveryAlerts(true);
    try {
      await onQueueDiscoveryAlerts(queueableDiscoveryAlerts);
    } finally {
      setQueueingDiscoveryAlerts(false);
    }
  }

  async function handleCopyReceiptAudit(
    receipt: ApplicationReceipt,
    job: ApplyAgentJob | undefined
  ) {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(formatReceiptAuditSummary(receipt, job));
    setCopiedReceiptId(receipt.id);
  }

  async function handleCopyProofPacket(packet: ApplicationPacket, job: ApplyAgentJob | undefined) {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(formatProofPacketSummary(packet, job));
    setCopiedProofPacketJobId(packet.job_id);
  }

  async function handleBrowserCheck(queueId: string) {
    setCheckingQueueId(queueId);
    setBrowserCheckError(null);
    try {
      await onRunBrowserCheck(queueId);
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Browser check failed');
    } finally {
      setCheckingQueueId(null);
    }
  }

  async function handleBrowserCheckBatch() {
    const queueIds = Array.from(selectedQueueIds);
    if (queueIds.length === 0) return;
    setCheckingBatch(true);
    setBrowserCheckError(null);
    try {
      await onRunBrowserCheckBatch(queueIds);
      setSelectedQueueIds(new Set());
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Browser checks failed');
    } finally {
      setCheckingBatch(false);
    }
  }

  async function handleGuardedSubmit(queueId: string) {
    const blockingWarnings = (queueSafetyWarnings.get(queueId) ?? []).filter(
      (warning) => warning.blocksSubmit
    );
    if (blockingWarnings.length > 0) {
      setBrowserCheckError(
        `Resolve safety review first: ${blockingWarnings.map((warning) => warning.label).join(', ')}.`
      );
      return;
    }
    if (remainingGuardedSubmitsToday <= 0) {
      setBrowserCheckError(
        `Daily guarded submit cap reached (${guardedSubmitsToday}/${dailyGuardedSubmitCap}). Raise the safety cap or wait until tomorrow.`
      );
      return;
    }
    const confirmed = window.confirm(
      'RolePatch will use Cloudflare Browser Rendering to fill the ATS page and click submit only if no CAPTCHA, file upload, or required-field blocker remains. Continue?'
    );
    if (!confirmed) return;
    setSubmittingQueueId(queueId);
    setBrowserCheckError(null);
    try {
      await onRunGuardedSubmit(queueId);
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Guarded submit failed');
    } finally {
      setSubmittingQueueId(null);
    }
  }

  async function handleGuardedSubmitBatch() {
    const queueIds = Array.from(selectedQueueIds).filter(
      (id) => queue.find((entry) => entry.id === id)?.status === 'ready_to_submit'
    );
    if (queueIds.length === 0) {
      setBrowserCheckError('Select at least one ready queue entry before guarded submit.');
      return;
    }
    const blockedQueueIds = queueIds.filter((id) =>
      (queueSafetyWarnings.get(id) ?? []).some((warning) => warning.blocksSubmit)
    );
    if (blockedQueueIds.length > 0) {
      setBrowserCheckError(
        `Resolve safety review on ${blockedQueueIds.length} selected ${
          blockedQueueIds.length === 1 ? 'entry' : 'entries'
        } before guarded submit.`
      );
      return;
    }
    if (remainingGuardedSubmitsToday <= 0) {
      setBrowserCheckError(
        `Daily guarded submit cap reached (${guardedSubmitsToday}/${dailyGuardedSubmitCap}). Raise the safety cap or wait until tomorrow.`
      );
      return;
    }
    const allowedQueueIds = queueIds.slice(0, remainingGuardedSubmitsToday);
    const confirmed = window.confirm(
      `RolePatch will run guarded Browser Rendering submit for ${allowedQueueIds.length} ready queue ${
        allowedQueueIds.length === 1 ? 'entry' : 'entries'
      }. It will refuse CAPTCHA, file uploads, and missing required fields. Continue?`
    );
    if (!confirmed) return;
    setSubmittingBatch(true);
    setBrowserCheckError(null);
    try {
      await onRunGuardedSubmitBatch(allowedQueueIds);
      setSelectedQueueIds(new Set());
    } catch (err) {
      setBrowserCheckError(err instanceof Error ? err.message : 'Guarded submit batch failed');
    } finally {
      setSubmittingBatch(false);
    }
  }

  const queueFilters: Array<{ key: QueueFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: queue.length },
    {
      key: 'ready',
      label: 'Ready',
      count: queue.filter(
        (entry) =>
          entry.status === 'ready_to_submit' || entry.readiness.status === 'ready_for_review'
      ).length,
    },
    {
      key: 'needs_user',
      label: 'Needs you',
      count: queue.filter((entry) => entry.status === 'needs_user').length,
    },
    {
      key: 'failed',
      label: 'Failed',
      count: queue.filter((entry) => entry.status === 'failed').length,
    },
    {
      key: 'skipped',
      label: 'Skipped',
      count: queue.filter((entry) => entry.status === 'skipped').length,
    },
  ];

  return (
    <section className="mb-12 rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent">
            <Bot className="h-3.5 w-3.5" />
            Apply agent
          </div>
          <h2 className="text-2xl font-bold">Command center</h2>
          <p className="mt-1 max-w-2xl text-xs font-medium text-[var(--muted-foreground)] opacity-70">
            Prepare high-volume applications without losing review control. Guarded submit is live;
            bulk unattended apply remains outside the product boundary.
          </p>
        </div>
        <Link
          href="/tools"
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
        >
          Review tools
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-3">
          {readiness.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4"
            >
              <item.icon className="mb-3 h-4 w-4 text-[var(--muted-foreground)]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)] opacity-70">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-black">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)]/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Guardrailed roadmap
          </div>
          <div className="space-y-2">
            {roadmap.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-[var(--muted-foreground)]">{item.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                    item.state === 'Live'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-muted text-[var(--muted-foreground)]'
                  }`}
                >
                  {item.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)]/60">
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Apply mode gates
          </p>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            review-first
          </span>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {applyModeReadiness.map((mode) => (
            <div key={mode.label} className="rounded-xl border border-[var(--border)]/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-foreground">{mode.label}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                    mode.state === 'Live' || mode.state === 'Ready'
                      ? 'bg-accent/10 text-accent'
                      : mode.state === 'Blocked' || mode.state === 'Locked'
                        ? 'bg-red-500/10 text-red-300'
                        : 'bg-muted text-[var(--muted-foreground)]'
                  }`}
                >
                  {mode.state}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {mode.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onQueueReadyApplications()}
          disabled={queueableReadyCount === 0}
          className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Queue ready jobs ({queueableReadyCount})
        </button>
        <button
          type="button"
          onClick={() => void onRefreshReadiness()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh readiness
        </button>
      </div>

      {queue.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Queue safety
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {queueSafetySummary.blockedEntries > 0
                  ? 'Resolve blocking warnings before guarded submit.'
                  : 'No blocking warnings found for queued applications.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-destructive">
                {queueSafetySummary.blockedEntries} blocked
              </span>
              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                {queueSafetySummary.totalWarnings} warnings
              </span>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-accent">
                {queueSafetySummary.cleanEntries} clean
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[var(--border)]/60">
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Match feed
          </p>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Top {matchFeed.length}
          </span>
        </div>
        {matchFeed.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            Add jobs and generate fit scores to rank your best applications.
          </div>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {matchFeed.map(({ job, fit, score }) => (
              <div
                key={job.id}
                className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {job.role || 'Untitled role'}
                    </p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {job.company || 'Unknown company'}
                    </p>
                  </div>
                  <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-black text-accent">
                    {Math.max(0, Math.min(100, Math.round(score)))}%
                  </span>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                  <span>{fit != null ? `Fit ${fit}` : 'Fit pending'}</span>
                  <span>{job.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tailor/${job.id}`}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground"
                  >
                    Tailor
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onQueueApplication(job.id)}
                    disabled={queuedJobIds.has(job.id)}
                    className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {queuedJobIds.has(job.id) ? 'Queued' : 'Queue'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {actionableDiscoveryAlerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5">
          <div className="flex items-center justify-between border-b border-[var(--primary)]/15 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)]">
              Discovery alerts
            </p>
            <div className="flex items-center gap-3">
              <span className="hidden text-[10px] font-black uppercase tracking-widest text-[var(--primary)] sm:inline">
                Queue from saved searches
              </span>
              <button
                type="button"
                onClick={() => void handleQueueDiscoveryAlertBatch()}
                disabled={queueableDiscoveryAlerts.length === 0 || queueingDiscoveryAlerts}
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {queueingDiscoveryAlerts
                  ? 'Queueing alerts'
                  : queueableDiscoveryAlerts.length > 0
                    ? `Queue ${queueableDiscoveryAlerts.length} alerts`
                    : 'Alerts queued'}
              </button>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {actionableDiscoveryAlerts.map((alert) => {
              const alreadyQueued = Boolean(
                alert.job_url && queuedJobUrls.has(normalizeJobUrl(alert.job_url))
              );
              return (
                <div
                  key={alert.id}
                  className="rounded-xl border border-[var(--border)]/60 bg-background p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {alert.title || 'New role'}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {alert.detail}
                      </p>
                    </div>
                    {!alert.seen && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-accent">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.job_url && (
                      <a
                        href={alert.job_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground"
                      >
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void onQueueDiscoveryAlert(alert)}
                      disabled={alreadyQueued}
                      className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {alreadyQueued ? 'Queued' : 'Add to queue'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[var(--border)]/60">
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            <BarChart3 className="h-3.5 w-3.5" />
            Automation health
          </p>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            {plural(automationHealth.browserReceipts, 'browser receipt')}
          </span>
        </div>
        {automationHealth.browserReceipts === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            Run reviewed browser checks to start measuring provider reliability before expanding
            automation.
          </div>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Guarded submits
              </p>
              <p className="mt-2 text-2xl font-black">
                {automationHealth.submitSuccesses}/{automationHealth.submitAttempts}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Confirmed submits over guarded attempts.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Provider evidence
              </p>
              <div className="space-y-2">
                {automationHealth.providers.slice(0, 4).map((provider) => (
                  <div key={provider.provider}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-bold text-foreground">
                        {provider.provider}
                      </span>
                      <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                        {provider.successRate}% success · {provider.blockedRate}% blocked
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                      {provider.submitted} submitted · {provider.blocked} blocked ·{' '}
                      {provider.attempts} total · {provider.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Top blockers
              </p>
              {automationHealth.failures.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  No browser blockers recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {automationHealth.failures.slice(0, 3).map((failure) => (
                    <div key={failure.code}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-foreground">
                          {failureCodeLabel(failure.code)}
                          {failure.provider ? ` · ${failure.provider}` : ''}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                          {failure.count}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                        {getApplyAgentRemediation(failure.provider, failure.code).detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {answerGapPrompts.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/5">
          <div className="flex items-center justify-between gap-3 border-b border-amber-400/20 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-300">
              <AlertCircle className="h-3.5 w-3.5" />
              Missing answer prompts
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">
              {plural(answerGapPrompts.length, 'field')}
            </span>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {answerGapPrompts.map((prompt) => (
              <div
                key={`${prompt.receiptId}:${prompt.label}`}
                className="rounded-xl border border-[var(--border)]/60 bg-background p-4"
              >
                <p className="text-sm font-bold text-foreground">{prompt.label}</p>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                  Blocked on {prompt.provider} for {prompt.jobLabel}.
                </p>
                <button
                  type="button"
                  onClick={() => handleAnswerGapPrompt(prompt.label)}
                  className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 transition-opacity hover:opacity-90"
                >
                  Use prompt
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[var(--border)]/60">
        <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            Application queue
          </p>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
            {plural(queue.length, 'entry', 'entries')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)]/60 px-4 py-3">
          {queueFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setQueueFilter(filter.key)}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                queueFilter === filter.key
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground'
              }`}
            >
              {filter.label} {filter.count}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)]/60 px-4 py-3">
          <button
            type="button"
            onClick={toggleVisibleQueueSelection}
            disabled={visibleQueueIds.length === 0}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            {allVisibleSelected ? 'Clear visible' : 'Select visible'}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {plural(selectedQueueCount, 'selected', 'selected')}
            </span>
            <button
              type="button"
              onClick={() => void handleBulkStatus('ready_to_submit')}
              disabled={selectedQueueCount === 0 || checkingBatch}
              className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Mark ready
            </button>
            <button
              type="button"
              onClick={() => void handleBrowserCheckBatch()}
              disabled={selectedQueueCount === 0 || checkingBatch || submittingBatch}
              className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs font-bold text-[var(--primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {checkingBatch ? 'Checking...' : 'Run checks'}
            </button>
            <button
              type="button"
              onClick={() => void handleGuardedSubmitBatch()}
              disabled={selectedQueueCount === 0 || submittingBatch}
              className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs font-bold text-[var(--primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {submittingBatch ? 'Running...' : 'Guarded submit'}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStatus('skipped')}
              disabled={selectedQueueCount === 0}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => void handleBulkStatus('failed')}
              disabled={selectedQueueCount === 0}
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Mark failed
            </button>
          </div>
        </div>
        {browserCheckError && (
          <div className="border-b border-[var(--border)]/60 px-4 py-3 text-xs font-medium text-destructive">
            {browserCheckError}
          </div>
        )}
        {queue.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            No queued applications yet. Tailor a role, then queue it for review.
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
            No applications match this filter.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/50">
            {filteredQueue.slice(0, 8).map((entry) => {
              const job = jobsById.get(entry.job_id);
              const semanticDiscoveryNote = parseSemanticDiscoveryNote(job?.notes);
              const discoveryAlertNote = parseDiscoveryAlertNote(job?.notes);
              const rolePatchQueueNoteRemainder = parseRolePatchQueueNoteRemainder(job?.notes);
              const receipt = receiptsByJob.get(entry.job_id);
              const failureCode = receiptFailureCode(receipt);
              const remediation = failureCode
                ? getApplyAgentRemediation(receipt?.provider, failureCode)
                : null;
              const receiptHistory = receiptHistoryByJob.get(entry.job_id) ?? [];
              const packet = packetsByJob.get(entry.job_id);
              const safetyWarnings = queueSafetyWarnings.get(entry.id) ?? [];
              const hasSafetyBlocker = safetyWarnings.some((warning) => warning.blocksSubmit);
              return (
                <div key={entry.id} className="px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                    <div className="min-w-0">
                      <label className="mb-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                        <input
                          type="checkbox"
                          checked={selectedQueueIds.has(entry.id)}
                          onChange={() => toggleQueueSelection(entry.id)}
                          className="accent-[var(--primary)]"
                          aria-label={`Select ${job?.role || 'queued role'}`}
                        />
                        Select
                      </label>
                      <p className="truncate text-sm font-bold text-foreground">
                        {job?.role || 'Queued role'}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {job?.company || 'Unknown company'} · {entry.readiness.summary}
                      </p>
                      {semanticDiscoveryNote || discoveryAlertNote ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {semanticDiscoveryNote && (
                            <span className="rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                              {semanticDiscoveryNote.score}% resume match
                            </span>
                          )}
                          {semanticDiscoveryNote?.evidence.length ? (
                            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                              Evidence: {semanticDiscoveryNote.evidence.join(', ')}
                            </span>
                          ) : null}
                          {discoveryAlertNote && (
                            <span className="rounded-full border border-[var(--border)] bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                              Discovery: {discoveryAlertNote.source}
                            </span>
                          )}
                          {discoveryAlertNote?.location && (
                            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                              {discoveryAlertNote.location}
                            </span>
                          )}
                          {rolePatchQueueNoteRemainder && (
                            <span className="basis-full text-[11px] font-medium text-[var(--muted-foreground)]">
                              {rolePatchQueueNoteRemainder}
                            </span>
                          )}
                        </div>
                      ) : job?.notes ? (
                        <p className="mt-1 line-clamp-2 text-[11px] font-medium text-[var(--muted-foreground)]">
                          {job.notes}
                        </p>
                      ) : null}
                      {entry.readiness.missing.length > 0 && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                          Missing: {entry.readiness.missing.join(', ')}
                        </p>
                      )}
                      {safetyWarnings.length > 0 && (
                        <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/5 p-3">
                          <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Safety review
                          </p>
                          <div className="space-y-1.5">
                            {safetyWarnings.map((warning) => (
                              <div key={warning.id} className="text-xs">
                                <span className="font-bold text-foreground">{warning.label}</span>
                                <span className="text-[var(--muted-foreground)]">
                                  {' '}
                                  — {warning.detail}
                                </span>
                                {warning.missingCategories?.length ? (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {warning.missingCategories.map((category) => (
                                      <button
                                        key={category}
                                        type="button"
                                        onClick={() => handleRequiredSafetyAnswerPrompt(category)}
                                        className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200 transition-opacity hover:opacity-90"
                                      >
                                        Add {profileCategoryLabel(category)}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                        {readinessMaterialChecklist(entry).map((item) => (
                          <div
                            key={item.key}
                            className={`rounded-lg border px-2.5 py-2 ${
                              item.ready
                                ? 'border-accent/20 bg-accent/10'
                                : 'border-[var(--border)] bg-muted/30'
                            }`}
                          >
                            <div
                              className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${
                                item.ready ? 'text-accent' : 'text-[var(--muted-foreground)]'
                              }`}
                            >
                              {item.ready ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              {item.label}
                            </div>
                            <p className="mt-1 text-[10px] font-medium text-[var(--muted-foreground)]">
                              {item.ready ? 'ready' : item.next}
                            </p>
                          </div>
                        ))}
                      </div>
                      {receipt && (
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-accent">
                            Receipt: {receipt.provider || 'unknown'} · {receipt.confirmation_text}
                          </p>
                          {(() => {
                            const summary = receiptSummary(receipt);
                            return (
                              <div className="flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                                <span className="rounded-full border border-[var(--border)] bg-muted/30 px-2 py-0.5">
                                  {summary.answeredFields} answered
                                </span>
                                <span className="rounded-full border border-[var(--border)] bg-muted/30 px-2 py-0.5">
                                  {summary.skippedFields} skipped
                                </span>
                                <span className="rounded-full border border-[var(--border)] bg-muted/30 px-2 py-0.5">
                                  {summary.uploadedFiles} uploaded
                                </span>
                                {summary.proofCandidates > 0 && (
                                  <span className="rounded-full border border-[var(--border)] bg-muted/30 px-2 py-0.5">
                                    {summary.proofCandidates} proof candidates
                                  </span>
                                )}
                                {summary.manualUploads > 0 && (
                                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                                    {summary.manualUploads} manual uploads
                                  </span>
                                )}
                                {summary.blockers > 0 && (
                                  <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-destructive">
                                    {summary.blockers} blockers
                                  </span>
                                )}
                                {summary.hasConfirmation && (
                                  <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-accent">
                                    confirmation captured
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          {receipt.fields.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setReceiptDetailId(
                                  receiptDetailId === receipt.id ? null : receipt.id
                                )
                              }
                              className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                            >
                              {receiptDetailId === receipt.id ? 'Hide fields' : 'Fields'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleCopyReceiptAudit(receipt, job)}
                            className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                          >
                            {copiedReceiptId === receipt.id ? 'Copied receipt' : 'Copy receipt'}
                          </button>
                          {remediation && (
                            <p className="text-xs text-[var(--muted-foreground)]">
                              Next: {remediation.title} — {remediation.detail}
                            </p>
                          )}
                          {receiptDetailId === receipt.id && (
                            <div className="mt-2 rounded-lg border border-[var(--border)]/60 bg-muted/20 p-3">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                                Captured fields
                              </p>
                              <div className="grid gap-2 md:grid-cols-2">
                                {receipt.fields.map((field, index) => (
                                  <div
                                    key={`${field.label}:${index}`}
                                    className="rounded-lg border border-[var(--border)]/60 bg-background p-3"
                                  >
                                    <div className="mb-1 flex items-start justify-between gap-2">
                                      <p className="text-xs font-bold text-foreground">
                                        {field.label}
                                      </p>
                                      <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                                        {field.source}
                                      </span>
                                    </div>
                                    <p className="break-words text-xs text-[var(--muted-foreground)]">
                                      {field.value || 'No value captured'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {receiptHistory.length > 1 && (
                            <div className="mt-2 rounded-lg border border-[var(--border)]/60 bg-muted/20 p-3">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                                Receipt timeline
                              </p>
                              <div className="space-y-1.5">
                                {receiptHistory.slice(0, 3).map((item) => {
                                  const itemSummary = receiptSummary(item);
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                                    >
                                      <span className="font-bold text-foreground">
                                        {item.status} · {item.provider || 'unknown'}
                                      </span>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                                        {itemSummary.answeredFields} answered ·{' '}
                                        {itemSummary.proofCandidates > 0
                                          ? `${itemSummary.proofCandidates} proof · `
                                          : ''}
                                        {itemSummary.blockers} blockers ·{' '}
                                        {formatReceiptTime(item.created_at)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <select
                      value={entry.status}
                      onChange={(event) =>
                        void onUpdateQueueStatus(
                          entry.id,
                          event.target.value as ApplicationQueueStatus
                        )
                      }
                      className="h-9 rounded-lg border border-[var(--border)] bg-background px-3 text-xs font-bold text-foreground"
                    >
                      {APPLICATION_QUEUE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {queueStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2 md:justify-end">
                      {!queuedJobIds.has(entry.job_id) && (
                        <button
                          type="button"
                          onClick={() => void onQueueApplication(entry.job_id)}
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)]"
                        >
                          Queue
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onRecordManualReceipt(entry.id)}
                        disabled={entry.status === 'submitted'}
                        className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        Mark submitted
                      </button>
                      {entry.status !== 'submitted' && (
                        <button
                          type="button"
                          onClick={() => void onRetryQueueEntry(entry.id)}
                          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleBrowserCheck(entry.id)}
                        disabled={entry.status === 'submitted' || checkingQueueId === entry.id}
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                      >
                        {checkingQueueId === entry.id ? 'Checking...' : 'Browser check'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGuardedSubmit(entry.id)}
                        disabled={
                          entry.status !== 'ready_to_submit' ||
                          submittingQueueId === entry.id ||
                          hasSafetyBlocker
                        }
                        className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-xs font-bold text-[var(--primary)] transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {submittingQueueId === entry.id ? 'Running...' : 'Guarded submit'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPacketJobId(packetJobId === entry.job_id ? null : entry.job_id)
                        }
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-muted hover:text-foreground"
                      >
                        Packet
                      </button>
                    </div>
                  </div>
                  {packetJobId === entry.job_id && job && (
                    <div className="mt-4 rounded-xl border border-[var(--border)]/60 bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                          Prepared application packet
                        </p>
                        {(packet?.ats_url || job.url) && (
                          <a
                            href={packet?.ats_url || job.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline"
                          >
                            {packet?.ats_provider || 'ATS'} page{' '}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Link
                          href={`/tailor/${job.id}`}
                          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          Resume: {packet?.tailored_resume_id ? 'tailored' : 'needs tailoring'}
                        </Link>
                        <Link
                          href={`/cover-letter/${job.id}`}
                          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          Cover letter: {packet?.cover_letter_id ? 'ready' : 'create'}
                        </Link>
                        <Link
                          href={`/interview-prep/${job.id}`}
                          className="rounded-lg border border-[var(--border)] bg-background px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
                        >
                          Interview prep
                        </Link>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-[var(--border)]/60 bg-background p-3">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                            Resume material
                          </p>
                          <p className="text-xs font-bold text-foreground">
                            {packet?.resume_name || 'Base resume'}
                          </p>
                          <p className="mt-1 line-clamp-3 text-xs text-[var(--muted-foreground)]">
                            {packet?.tailored_excerpt || 'Tailor this role before applying.'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[var(--border)]/60 bg-background p-3">
                          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                            Cover letter
                          </p>
                          <p className="line-clamp-4 text-xs text-[var(--muted-foreground)]">
                            {packet?.cover_letter_excerpt ||
                              'Generate a cover letter for this role.'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {(packet?.profile_answers ?? profileAnswers).length === 0 ? (
                          <p className="text-sm text-[var(--muted-foreground)]">
                            Add profile answers below to make the packet copy-ready.
                          </p>
                        ) : (
                          (packet?.profile_answers ?? profileAnswers).slice(0, 6).map((answer) => (
                            <div
                              key={answer.id}
                              className="rounded-lg border border-[var(--border)]/60 bg-background p-3"
                            >
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-foreground">{answer.label}</p>
                                <Copy className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                              </div>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {answer.answer}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                      {packet && (packet.proof_items?.length ?? 0) > 0 && (
                        <div className="mt-4 rounded-lg border border-[var(--border)]/60 bg-background p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                              Optional proof points
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleCopyProofPacket(packet, job)}
                                className="text-[11px] font-bold text-[var(--primary)] hover:underline"
                              >
                                {copiedProofPacketJobId === packet.job_id
                                  ? 'Copied proof'
                                  : 'Copy proof packet'}
                              </button>
                              <Link
                                href="/proof"
                                className="text-[11px] font-bold text-[var(--primary)] hover:underline"
                              >
                                Review proof
                              </Link>
                            </div>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {packet?.proof_items?.slice(0, 4).map((item) => (
                              <div
                                key={item.id}
                                className="rounded-lg border border-[var(--border)]/60 bg-muted/20 p-3"
                              >
                                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--accent)]">
                                    {item.readiness}
                                  </span>
                                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                                    User-provided
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-foreground">{item.title}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                                  {item.claim}
                                </p>
                                {item.source_url && (
                                  <a
                                    href={item.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-flex text-[11px] font-bold text-[var(--primary)] hover:underline"
                                  >
                                    Source
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {packet?.receipt && (
                        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/10 p-3">
                          <p className="text-xs font-bold text-accent">
                            Receipt recorded: {packet.receipt.provider || 'unknown provider'}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            {packet.receipt.fields.length} fields captured ·{' '}
                            {packet.receipt.confirmation_text || 'No confirmation text'}
                          </p>
                          {(() => {
                            const summary = receiptSummary(packet.receipt);
                            return (
                              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                                <span>{summary.answeredFields} answered</span>
                                <span>{summary.skippedFields} skipped</span>
                                <span>{summary.uploadedFiles} uploaded</span>
                                {summary.proofCandidates > 0 && (
                                  <span>{summary.proofCandidates} proof candidates</span>
                                )}
                                {summary.manualUploads > 0 && (
                                  <span>{summary.manualUploads} manual uploads</span>
                                )}
                                {summary.blockers > 0 && <span>{summary.blockers} blockers</span>}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={handleProfileSubmit}
          className="rounded-xl border border-[var(--border)]/60 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {editingProfileAnswerId ? 'Edit profile answer' : 'Profile answers'}
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {plural(profileAnswers.length, 'answer')}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-[160px_1fr]">
            <select
              value={profileCategory}
              onChange={(event) => setProfileCategory(event.target.value as ProfileAnswerCategory)}
              className="h-10 rounded-lg border border-[var(--border)] bg-background px-3 text-xs font-bold text-foreground"
            >
              {PROFILE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            <input
              value={profileLabel}
              onChange={(event) => setProfileLabel(event.target.value)}
              placeholder="ATS question label"
              className="input-base"
            />
          </div>
          <textarea
            value={profileAnswer}
            onChange={(event) => setProfileAnswer(event.target.value)}
            placeholder="Answer exactly how it should be used in applications"
            className="input-base mt-3 min-h-20"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={profileSensitive}
                onChange={(event) => setProfileSensitive(event.target.checked)}
                className="accent-[var(--primary)]"
              />
              Require review before use
            </label>
            <div className="flex items-center gap-2">
              {editingProfileAnswerId && (
                <button
                  type="button"
                  onClick={handleCancelProfileEdit}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancel edit
                </button>
              )}
              <button
                type="submit"
                disabled={savingProfile || !profileLabel.trim() || !profileAnswer.trim()}
                className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {savingProfile
                  ? 'Saving...'
                  : editingProfileAnswerId
                    ? 'Update answer'
                    : 'Save answer'}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-xl border border-[var(--border)]/60 p-4">
          <div className="mb-3 rounded-lg border border-[var(--border)]/50 bg-muted/20 p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              Safety preferences
            </p>
            <div className="mt-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Excluded companies</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {excludedCompanyTerms.length > 0
                      ? `${plural(excludedCompanyTerms.length, 'company', 'companies')} blocked from guarded submit.`
                      : 'Add companies that should never be submitted by guarded workflows.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExcludedCompaniesPrompt}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                >
                  {exclusionProfileAnswer ? 'Edit exclusions' : 'Add exclusions'}
                </button>
              </div>
              {excludedCompanyTerms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {excludedCompanyTerms.slice(0, 6).map((term) => (
                    <span
                      key={term}
                      className="rounded-full border border-destructive/25 bg-destructive/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-destructive"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              )}
              <div className="border-t border-[var(--border)]/50 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">Minimum fit score</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      Guarded submit blocks roles below {minimumFitScore}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleMinimumFitPrompt}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {minimumFitProfileAnswer ? 'Edit threshold' : 'Set threshold'}
                  </button>
                </div>
              </div>
              <div className="border-t border-[var(--border)]/50 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">Daily guarded submit cap</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {guardedSubmitsToday}/{dailyGuardedSubmitCap} guarded submits used today;{' '}
                      {remainingGuardedSubmitsToday} remaining.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDailyGuardedCapPrompt}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {dailyGuardedCapProfileAnswer ? 'Edit cap' : 'Set cap'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              Answer bank review
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
              {answerBankReview.readyCategoryCount}/{REQUIRED_ANSWER_CATEGORIES.length} covered
            </span>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[var(--border)]/50 bg-muted/20 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Review required
              </p>
              <p className="mt-1 text-lg font-black text-foreground">
                {answerBankReview.sensitiveCount}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)]/50 bg-muted/20 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                Last learned
              </p>
              <p className="mt-1 truncate text-sm font-black text-foreground">
                {answerBankReview.latestUpdatedAt
                  ? formatReceiptTime(answerBankReview.latestUpdatedAt)
                  : 'None'}
              </p>
            </div>
          </div>
          {answerBankReview.missingCategories.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-400/25 bg-amber-500/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                Missing coverage
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {answerBankReview.missingCategories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-amber-400/25 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200"
                  >
                    {profileCategoryLabel(category)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profileAnswers.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              Add work authorization, sponsorship, links, and salary answers before browser apply.
            </p>
          ) : (
            <div className="space-y-2">
              {profileAnswers.slice(0, 5).map((answer) => (
                <div
                  key={answer.id}
                  className="rounded-lg border border-[var(--border)]/50 bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground">{answer.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                        {answer.answer}
                      </p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                        {profileCategoryLabel(answer.category)}
                        {isSensitiveAnswer(answer) ? ' · review required' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditProfileAnswer(answer)}
                        className="text-xs font-bold text-[var(--muted-foreground)] hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteProfileAnswer(answer.id)}
                        className="text-xs font-bold text-[var(--muted-foreground)] hover:text-destructive"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)]/60 bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
          <span className="font-medium text-foreground">Next step:</span>
          <span className="text-[var(--muted-foreground)]">{nextStep}</span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
          {plural(jobs.length, 'job')} tracked
        </span>
      </div>
    </section>
  );
}
