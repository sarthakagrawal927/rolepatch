export type JsonObjectInputResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

export function parseJsonObjectInput(body: unknown): JsonObjectInputResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be an object' };
  }
  return { ok: true, body: body as Record<string, unknown> };
}
