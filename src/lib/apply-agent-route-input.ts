import { APPLICATION_QUEUE_STATUSES } from '@/lib/apply-agent';
import type { ApplicationQueueStatus } from '@/lib/types';

export interface ApplyAgentBrowserRunInput {
  queueId?: string;
  queueIds: string[];
  limit?: number;
}

type ObjectInputResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

export type ApplyAgentBrowserRunInputResult =
  | { ok: true; input: ApplyAgentBrowserRunInput }
  | { ok: false; error: string };

export type ApplyAgentQueueCreateInputResult =
  | { ok: true; input: { jobId: string } }
  | { ok: false; error: string };

export type ApplyAgentQueueStatusInputResult =
  | { ok: true; input: { status: ApplicationQueueStatus } }
  | { ok: false; error: string };

export type ApplyAgentQueueBulkStatusInputResult =
  | { ok: true; input: { queueIds: string[]; status: ApplicationQueueStatus } }
  | { ok: false; error: string };

export type ApplyAgentQueueRetryInputResult =
  | { ok: true; input: { action: 'retry' } }
  | { ok: false; error: string };

export type ApplyAgentManualReceiptInputResult =
  | {
      ok: true;
      input: { queueId: string; confirmationText?: string; confirmationUrl?: string };
    }
  | { ok: false; error: string };

function parseObjectInput(body: unknown): ObjectInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be an object' };
  }
  return { ok: true, body: body as Record<string, unknown> };
}

function stringField(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  return typeof value === 'string' ? value.trim() : undefined;
}

function stringArrayField(body: Record<string, unknown>, field: string): string[] {
  const value = body[field];
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter(Boolean)
        ),
      ]
    : [];
}

function statusField(body: Record<string, unknown>): ApplicationQueueStatus | undefined | null {
  const value = body.status;
  if (typeof value !== 'string') return value == null ? undefined : null;
  return APPLICATION_QUEUE_STATUSES.includes(value as ApplicationQueueStatus)
    ? (value as ApplicationQueueStatus)
    : null;
}

export function parseApplyAgentBrowserRunInput(body: unknown): ApplyAgentBrowserRunInputResult {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;

  const record = parsed.body;
  const queueId = stringField(record, 'queue_id');
  const queueIds = stringArrayField(record, 'queue_ids');

  let limit: number | undefined;
  if (record.limit != null) {
    if (typeof record.limit !== 'number' || !Number.isInteger(record.limit) || record.limit <= 0) {
      return { ok: false, error: 'limit must be a positive integer' };
    }
    limit = record.limit;
  }

  if (!queueId && queueIds.length === 0 && limit == null) {
    return { ok: false, error: 'queue_id is required' };
  }

  return { ok: true, input: { queueId, queueIds, limit } };
}

export function parseApplyAgentQueueCreateInput(body: unknown): ApplyAgentQueueCreateInputResult {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  const jobId = stringField(parsed.body, 'job_id');
  if (!jobId) return { ok: false, error: 'job_id is required' };
  return { ok: true, input: { jobId } };
}

export function parseApplyAgentQueueStatusInput(body: unknown): ApplyAgentQueueStatusInputResult {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  const status = statusField(parsed.body);
  if (status === undefined) return { ok: false, error: 'status is required' };
  if (status === null) return { ok: false, error: 'status is invalid' };
  return { ok: true, input: { status } };
}

export function parseApplyAgentQueueBulkStatusInput(
  body: unknown
): ApplyAgentQueueBulkStatusInputResult {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  const queueIds = stringArrayField(parsed.body, 'queue_ids');
  if (queueIds.length === 0) return { ok: false, error: 'queue_ids is required' };
  const status = statusField(parsed.body);
  if (status === undefined) return { ok: false, error: 'status is required' };
  if (status === null) return { ok: false, error: 'status is invalid' };
  return { ok: true, input: { queueIds, status } };
}

export function parseApplyAgentQueueRetryInput(body: unknown): ApplyAgentQueueRetryInputResult {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  if (stringField(parsed.body, 'action') !== 'retry') {
    return { ok: false, error: 'action must be retry' };
  }
  return { ok: true, input: { action: 'retry' } };
}

export function parseApplyAgentManualReceiptInput(
  body: unknown
): ApplyAgentManualReceiptInputResult {
  const parsed = parseObjectInput(body);
  if (!parsed.ok) return parsed;
  const queueId = stringField(parsed.body, 'queue_id');
  if (!queueId) return { ok: false, error: 'queue_id is required' };
  const confirmationText = stringField(parsed.body, 'confirmation_text');
  const confirmationUrl = stringField(parsed.body, 'confirmation_url');
  return {
    ok: true,
    input: {
      queueId,
      ...(confirmationText ? { confirmationText } : {}),
      ...(confirmationUrl ? { confirmationUrl } : {}),
    },
  };
}
