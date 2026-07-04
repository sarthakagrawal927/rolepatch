import type { ApplicationReceiptField } from '@/lib/types';

const VALID_RECEIPT_FIELD_SOURCES: ReadonlySet<ApplicationReceiptField['source']> = new Set([
  'profile',
  'resume',
  'cover_letter',
  'user',
  'system',
  'ats',
]);

type ObjectInputResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

export type ExtensionInputResult<T> = { ok: true; input: T } | { ok: false; error: string };

export interface ExtensionJobInput {
  url: string;
  title: string;
  company: string;
  jdText: string;
  queue?: boolean;
}

export interface ExtensionUrlInput {
  url: string;
}

export interface ExtensionFillReceiptInput {
  url: string;
  jobId: string;
  filled: number;
  detected: number;
  skipped: number;
  provider: string;
  submitDetected: boolean;
  uploadFields: string[];
  uploadedFiles: string[];
  fields: ApplicationReceiptField[];
  error: string;
}

export interface ExtensionSubmissionReceiptInput {
  jobId: string;
  originalUrl: string;
  confirmationUrl: string;
  confirmationText: string;
  provider: string;
  status?: 'submitted' | 'failed';
  failureReason: string;
  mode: string;
  fields: ApplicationReceiptField[];
}

function parseObjectInput(body: unknown): ObjectInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be an object' };
  }
  return { ok: true, body: body as Record<string, unknown> };
}

function stringField(body: Record<string, unknown>, field: string, max = 50_000): string {
  const value = body[field];
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function booleanField(body: Record<string, unknown>, field: string): boolean | undefined {
  const value = body[field];
  return typeof value === 'boolean' ? value : undefined;
}

function numberField(body: Record<string, unknown>, field: string): number {
  const value = body[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function stringArrayField(body: Record<string, unknown>, field: string, limit = 12): string[] {
  const value = body[field];
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function receiptFieldsField(
  body: Record<string, unknown>,
  field: string,
  limit: number
): ApplicationReceiptField[] {
  const value = body[field];
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
    )
    .map((item) => {
      const label = stringField(item, 'label', 160).replace(/\s+/g, ' ');
      const fieldValue = stringField(item, 'value', 500).replace(/\s+/g, ' ');
      const rawSource = stringField(item, 'source', 40);
      const source = VALID_RECEIPT_FIELD_SOURCES.has(rawSource as ApplicationReceiptField['source'])
        ? (rawSource as ApplicationReceiptField['source'])
        : 'ats';
      return { label, value: fieldValue, source };
    })
    .filter((item) => item.label && item.value)
    .slice(0, limit);
}

export function parseExtensionJobInput(body: unknown): ExtensionInputResult<ExtensionJobInput> {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    input: {
      url: stringField(parsed.body, 'url'),
      title: stringField(parsed.body, 'title', 300),
      company: stringField(parsed.body, 'company', 300),
      jdText: stringField(parsed.body, 'jd_text'),
      queue: booleanField(parsed.body, 'queue'),
    },
  };
}

export function parseExtensionUrlInput(body: unknown): ExtensionInputResult<ExtensionUrlInput> {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  return { ok: true, input: { url: stringField(parsed.body, 'url') } };
}

export function parseExtensionFillReceiptInput(
  body: unknown
): ExtensionInputResult<ExtensionFillReceiptInput> {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    input: {
      url: stringField(parsed.body, 'url'),
      jobId: stringField(parsed.body, 'job_id'),
      filled: numberField(parsed.body, 'filled'),
      detected: numberField(parsed.body, 'detected'),
      skipped: numberField(parsed.body, 'skipped'),
      provider: stringField(parsed.body, 'provider', 120),
      submitDetected: booleanField(parsed.body, 'submit_detected') ?? false,
      uploadFields: stringArrayField(parsed.body, 'upload_fields'),
      uploadedFiles: stringArrayField(parsed.body, 'uploaded_files'),
      fields: receiptFieldsField(parsed.body, 'fields', 80),
      error: stringField(parsed.body, 'error', 800),
    },
  };
}

export function parseExtensionSubmissionReceiptInput(
  body: unknown
): ExtensionInputResult<ExtensionSubmissionReceiptInput> {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  const status = stringField(parsed.body, 'status', 40);
  return {
    ok: true,
    input: {
      jobId: stringField(parsed.body, 'job_id'),
      originalUrl: stringField(parsed.body, 'original_url'),
      confirmationUrl: stringField(parsed.body, 'confirmation_url'),
      confirmationText: stringField(parsed.body, 'confirmation_text', 1200),
      provider: stringField(parsed.body, 'provider', 120),
      status: status === 'submitted' || status === 'failed' ? status : undefined,
      failureReason: stringField(parsed.body, 'failure_reason', 800),
      mode: stringField(parsed.body, 'mode', 160),
      fields: receiptFieldsField(parsed.body, 'fields', 30),
    },
  };
}
