import type { JobApplication } from '@/lib/types';

export type RecruiterReplyClassification =
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'follow_up'
  | 'other';

export interface InboundRecruiterEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  message_id?: string | null;
  in_reply_to?: string | null;
}

export interface RecruiterReplyDecision {
  classification: RecruiterReplyClassification;
  status: JobApplication['status'] | null;
  summary: string;
}

export interface MatchedRecruiterJob {
  job: JobApplication;
  score: number;
  reasons: string[];
}

export interface RecruiterReplyDraftContext {
  classification: RecruiterReplyClassification;
  subject: string;
  from: string;
  job?: Pick<JobApplication, 'company' | 'role'> | null;
  proofItems?: RecruiterReplyDraftProofItem[];
  proofRequested?: boolean;
}

export interface RecruiterReplyDraft {
  subject: string;
  body: string;
}

export interface RecruiterReplyDraftProofItem {
  title: string;
  claim: string;
  source_url?: string;
}

const ROUTING_LOCAL_PREFIX = 'reply+';
const DEFAULT_ROUTING_DOMAIN = 'rolepatch.com';
const GENERIC_MAIL_DOMAINS = new Set([
  'gmail',
  'googlemail',
  'outlook',
  'hotmail',
  'icloud',
  'yahoo',
  'greenhouse',
  'lever',
  'ashbyhq',
  'workday',
  'smartrecruiters',
]);

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = `${value.replaceAll('-', '+').replaceAll('_', '/')}${'='.repeat(
      (4 - (value.length % 4)) % 4
    )}`;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function buildReplyRoutingAddress(userId: string, domain = DEFAULT_ROUTING_DOMAIN): string {
  return `${ROUTING_LOCAL_PREFIX}${base64UrlEncode(userId)}@${domain}`;
}

export function extractReplyRoutingUserId(address: string): string | null {
  const local = address.trim().split('@')[0] ?? '';
  if (!local.toLowerCase().startsWith(ROUTING_LOCAL_PREFIX)) return null;
  const token = local.slice(ROUTING_LOCAL_PREFIX.length);
  return base64UrlDecode(token);
}

export function plainTextFromRawEmail(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n');
  const [, ...bodyParts] = normalized.split(/\n\n/);
  const body = bodyParts.join('\n\n') || normalized;
  return body
    .replace(/^--[^\n]+$/gm, '')
    .replace(/^Content-[^:]+:.*$/gim, '')
    .replace(/^This is a multi-part message.*$/gim, '')
    .replace(/=\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

export function normalizeEmailThreadSubject(subject: string): string {
  return subject
    .replace(/^(\s*(re|fw|fwd):\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildRecruiterReplyThreadKey(
  email: Pick<InboundRecruiterEmail, 'from' | 'subject' | 'message_id' | 'in_reply_to'>
): string {
  if (email.in_reply_to) return `reply:${email.in_reply_to}`;
  if (email.message_id) return `message:${email.message_id}`;
  const domain = email.from.split('@')[1]?.toLowerCase().replace(/[> ]/g, '') ?? 'unknown';
  return `subject:${domain}:${normalizeEmailThreadSubject(email.subject) || 'no-subject'}`;
}

export function recruiterReplyRequestsProof(
  email: Pick<InboundRecruiterEmail, 'subject' | 'text'>
): boolean {
  return /\b(portfolio|work samples?|examples?|github|proof|evidence|verify|verification|references?|case stud(?:y|ies))\b/i.test(
    `${email.subject} ${email.text}`
  );
}

function greeting(from: string): string {
  const name = from
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/[^a-zA-Z ]/g, '')
    .trim()
    .split(' ')[0];
  return name ? `Hi ${name[0].toUpperCase()}${name.slice(1)},` : 'Hi,';
}

function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim() || 'Role update'}`;
}

export function buildRecruiterReplyDraft(context: RecruiterReplyDraftContext): RecruiterReplyDraft {
  const role = context.job?.role || 'the role';
  const company = context.job?.company || 'your team';
  const opener = greeting(context.from);
  const subject = replySubject(context.subject);

  const proofContext = proofReplyContext(context);

  if (context.classification === 'interview') {
    return {
      subject,
      body: `${opener}\n\nThanks for reaching out. I am interested in continuing for ${role} at ${company}. I would be happy to schedule the next step. Please send over the available times or scheduling link, and I will confirm promptly.${proofContext}\n\nBest,\n`,
    };
  }
  if (context.classification === 'offer') {
    return {
      subject,
      body: `${opener}\n\nThank you for the update and for sharing the offer details. I am excited about ${role} at ${company}. I will review the information carefully and follow up with any questions or confirmation shortly.${proofContext}\n\nBest,\n`,
    };
  }
  if (context.classification === 'rejected') {
    return {
      subject,
      body: `${opener}\n\nThank you for letting me know. I appreciate the time your team spent reviewing my application for ${role}. I would be glad to stay in touch for future opportunities that may be a stronger fit.\n\nBest,\n`,
    };
  }
  if (context.classification === 'follow_up') {
    return {
      subject,
      body: `${opener}\n\nThanks for following up. I am still interested in ${role} at ${company} and would be happy to share anything else that would be useful for the next step.${proofContext}\n\nBest,\n`,
    };
  }
  return {
    subject,
    body: `${opener}\n\nThanks for the note. I appreciate the update and am interested in learning more about the next step for ${role} at ${company}.${proofContext}\n\nBest,\n`,
  };
}

function proofReplyContext(context: RecruiterReplyDraftContext): string {
  if (!context.proofRequested || !context.proofItems || context.proofItems.length === 0) return '';
  const lines = context.proofItems.slice(0, 3).map((item) => {
    const source = item.source_url ? ` Source: ${item.source_url}` : '';
    return `- ${item.title}: ${item.claim}${source}`;
  });
  return `\n\nI can also share a short proof packet for relevant work if helpful:\n${lines.join('\n')}`;
}

export function classifyRecruiterReply(
  email: Pick<InboundRecruiterEmail, 'subject' | 'text'>
): RecruiterReplyDecision {
  const haystack = `${email.subject} ${email.text}`.toLowerCase();
  if (
    /\b(offer|offer letter|compensation package|pleased to offer|congratulations)\b/.test(haystack)
  ) {
    return {
      classification: 'offer',
      status: 'offer',
      summary: 'Recruiter reply appears to contain an offer or offer-stage update.',
    };
  }
  if (
    /\b(interview|schedule a call|schedule time|calendar|calendly|next round|onsite|phone screen)\b/.test(
      haystack
    )
  ) {
    return {
      classification: 'interview',
      status: 'interview',
      summary: 'Recruiter reply appears to request or confirm an interview step.',
    };
  }
  if (
    /\b(unfortunately|not selected|not moving forward|move forward with other|other candidates|not proceed|declined)\b/.test(
      haystack
    )
  ) {
    return {
      classification: 'rejected',
      status: 'rejected',
      summary: 'Recruiter reply appears to be a rejection or closed-loop update.',
    };
  }
  if (/\b(follow up|checking in|update|still interested|next steps?)\b/.test(haystack)) {
    return {
      classification: 'follow_up',
      status: null,
      summary: 'Recruiter reply appears to need follow-up but does not imply a status change.',
    };
  }
  return {
    classification: 'other',
    status: null,
    summary: 'Recruiter reply was captured, but no confident status change was inferred.',
  };
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
}

function senderDomainToken(from: string): string | null {
  const domain = from.split('@')[1]?.toLowerCase().split(/[> ]/)[0] ?? '';
  const token = domain.split('.')[0] ?? '';
  if (!token || GENERIC_MAIL_DOMAINS.has(token)) return null;
  return token;
}

export function findBestRecruiterJobMatch(
  email: Pick<InboundRecruiterEmail, 'from' | 'subject' | 'text'>,
  jobs: JobApplication[]
): MatchedRecruiterJob | null {
  const searchable = `${email.from} ${email.subject} ${email.text}`.toLowerCase();
  const domainToken = senderDomainToken(email.from);
  const candidates = jobs
    .filter((job) => !['offer', 'rejected'].includes(job.status))
    .map((job) => {
      let score = 0;
      const reasons: string[] = [];
      const companyWords = words(job.company);
      const roleWords = words(job.role);

      if (
        domainToken &&
        companyWords.some((word) => domainToken.includes(word) || word.includes(domainToken))
      ) {
        score += 8;
        reasons.push('sender domain matches company');
      }
      for (const word of companyWords) {
        if (searchable.includes(word)) {
          score += 4;
          reasons.push('company mentioned');
          break;
        }
      }
      for (const word of roleWords.slice(0, 4)) {
        if (searchable.includes(word)) score += 1;
      }
      return { job, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 5) return null;
  return best;
}
