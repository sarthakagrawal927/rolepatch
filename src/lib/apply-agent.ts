import type {
  ApplicationQueueEntry,
  ApplicationQueueStatus,
  ApplicationReceipt,
  ApplicationReceiptField,
  ApplyAgentReadiness,
  JobApplication,
} from '@/lib/types';

export const APPLICATION_QUEUE_STATUSES: ApplicationQueueStatus[] = [
  'queued',
  'needs_user',
  'ready_to_submit',
  'submitted',
  'failed',
  'skipped',
];

const SUBMITTED_JOB_STATUSES: JobApplication['status'][] = [
  'applied',
  'interview',
  'offer',
  'rejected',
];

export function inferAtsProvider(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('greenhouse.io')) return 'greenhouse';
  if (lower.includes('lever.co')) return 'lever';
  if (lower.includes('ashbyhq.com')) return 'ashby';
  if (lower.includes('myworkdayjobs.com') || lower.includes('workday')) return 'workday';
  if (lower.includes('workable.com')) return 'workable';
  if (lower.includes('recruitee.com')) return 'recruitee';
  if (lower.includes('personio.com') || lower.includes('personio.de')) return 'personio';
  if (lower.includes('icims.com')) return 'icims';
  if (lower.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (lower.includes('linkedin.com')) return 'linkedin';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

export function buildApplyAgentReadiness(input: {
  jobStatus: JobApplication['status'];
  hasResume: boolean;
  hasTailoredResume: boolean;
  hasCoverLetter: boolean;
  hasProfileAnswers?: boolean;
  hasReceipt?: boolean;
}): ApplyAgentReadiness {
  const checks = {
    resume: input.hasResume,
    tailored_resume: input.hasTailoredResume,
    cover_letter: input.hasCoverLetter,
    profile_answers: input.hasProfileAnswers ?? false,
    receipt: input.hasReceipt ?? false,
  };

  if (SUBMITTED_JOB_STATUSES.includes(input.jobStatus)) {
    return {
      status: 'submitted',
      summary: checks.receipt
        ? 'Application is submitted and has a receipt.'
        : 'Application is submitted; receipt can be added for auditability.',
      missing: checks.receipt ? [] : ['submission receipt'],
      checks,
    };
  }

  if (!checks.resume) {
    return {
      status: 'needs_resume',
      summary: 'Create or select a resume before queueing this application.',
      missing: ['resume'],
      checks,
    };
  }

  if (!checks.tailored_resume) {
    return {
      status: 'needs_tailoring',
      summary: 'Tailor the resume before this application can be reviewed.',
      missing: ['tailored resume'],
      checks,
    };
  }

  const missing = [
    ...(checks.cover_letter ? [] : ['cover letter']),
    ...(checks.profile_answers ? [] : ['profile answers']),
  ];

  return {
    status: 'ready_for_review',
    summary:
      missing.length > 0
        ? 'Tailored materials are ready; review missing optional answers before submit.'
        : 'Tailored materials and profile answers are ready for final review.',
    missing,
    checks,
  };
}

export function parseReadiness(raw: unknown): ApplyAgentReadiness {
  if (typeof raw === 'object' && raw != null && 'status' in raw && 'checks' in raw) {
    return raw as ApplyAgentReadiness;
  }
  if (typeof raw === 'string') {
    try {
      return parseReadiness(JSON.parse(raw));
    } catch {
      /* fall through */
    }
  }
  return buildApplyAgentReadiness({
    jobStatus: 'draft',
    hasResume: false,
    hasTailoredResume: false,
    hasCoverLetter: false,
  });
}

function parseReceiptFields(raw: unknown): ApplicationReceiptField[] {
  if (Array.isArray(raw)) return raw as ApplicationReceiptField[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ApplicationReceiptField[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function queueStatusLabel(status: ApplicationQueueStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'needs_user':
      return 'Needs you';
    case 'ready_to_submit':
      return 'Ready';
    case 'submitted':
      return 'Submitted';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
  }
  return status;
}

export function normalizeQueueEntry(
  entry: Omit<ApplicationQueueEntry, 'readiness'> & { readiness: unknown }
): ApplicationQueueEntry {
  return { ...entry, readiness: parseReadiness(entry.readiness) };
}

export function normalizeReceipt(
  receipt: Omit<ApplicationReceipt, 'fields'> & { fields: unknown }
): ApplicationReceipt {
  return { ...receipt, fields: parseReceiptFields(receipt.fields) };
}
