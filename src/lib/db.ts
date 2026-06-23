// Minimal Turso HTTP client. Replaces @libsql/client so the Cloudflare Worker
// bundle does not pull hrana-client → isomorphic-ws (blocked on workerd).
// Interface matches the subset the app uses: db.execute({ sql, args }) → { rows }.

type SqlArg = string | number | bigint | boolean | null | Uint8Array;

interface ExecuteArgs {
  sql: string;
  args?: readonly SqlArg[] | SqlArg[];
}

interface TursoResultValue {
  type: 'null' | 'integer' | 'float' | 'text' | 'blob';
  value?: string;
  base64?: string;
}

interface TursoResult {
  cols: Array<{ name: string }>;
  rows: TursoResultValue[][];
  affected_row_count?: number;
  last_insert_rowid?: string | null;
}

interface PipelineResponse {
  results: Array<
    | { type: 'ok'; response: { type: 'execute'; result: TursoResult } | { type: 'close' } }
    | { type: 'error'; error: { code?: string; message: string } }
  >;
}

type Row = Record<string, string | number | null | Uint8Array> & {
  [index: number]: string | number | null | Uint8Array;
};

function coerceArg(a: SqlArg) {
  if (a === null || a === undefined) return { type: 'null' as const };
  if (typeof a === 'number')
    return Number.isInteger(a)
      ? { type: 'integer' as const, value: String(a) }
      : { type: 'float' as const, value: String(a) };
  if (typeof a === 'bigint') return { type: 'integer' as const, value: a.toString() };
  if (typeof a === 'boolean') return { type: 'integer' as const, value: a ? '1' : '0' };
  if (a instanceof Uint8Array) {
    let b = '';
    for (const c of a) b += String.fromCharCode(c);
    return { type: 'blob' as const, base64: btoa(b) };
  }
  return { type: 'text' as const, value: String(a) };
}

function coerceRow(cols: Array<{ name: string }>, row: TursoResultValue[]): Row {
  const out = {} as Row;
  for (let i = 0; i < cols.length; i++) {
    const cell = row[i];
    let v: string | number | null | Uint8Array;
    switch (cell.type) {
      case 'null':
        v = null;
        break;
      case 'integer':
        v = cell.value != null ? Number(cell.value) : null;
        break;
      case 'float':
        v = cell.value != null ? Number(cell.value) : null;
        break;
      case 'blob': {
        if (!cell.base64) {
          v = new Uint8Array();
        } else {
          const bin = atob(cell.base64);
          const u = new Uint8Array(bin.length);
          for (let j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
          v = u;
        }
        break;
      }
      default:
        v = cell.value ?? null;
    }
    out[cols[i].name] = v!;
    out[i] = v!;
  }
  return out;
}

function httpUrlFromLibsqlUrl(raw: string | undefined): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  if (raw.startsWith('libsql://'))
    return `https://${raw.slice('libsql://'.length).replace(/\/$/, '')}`;
  if (raw.startsWith('wss://')) return `https://${raw.slice('wss://'.length).replace(/\/$/, '')}`;
  if (raw.startsWith('ws://')) return `http://${raw.slice('ws://'.length).replace(/\/$/, '')}`;
  throw new Error(`Unsupported TURSO_DATABASE_URL scheme: ${raw}`);
}

interface ExecuteResult {
  rows: Row[];
  columns: string[];
  rowsAffected: number;
  lastInsertRowid: bigint | null;
}

async function runPipeline(
  base: string,
  authToken: string | undefined,
  baton: string | null,
  requests: Array<
    | { type: 'execute'; stmt: { sql: string; args: ReturnType<typeof coerceArg>[] } }
    | { type: 'close' }
  >
): Promise<{ baton: string | null; results: PipelineResponse['results'] }> {
  if (!base) {
    throw new Error('TURSO_DATABASE_URL is not set');
  }
  const res = await fetch(`${base}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(baton ? { baton, requests } : { requests }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Turso HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const payload = (await res.json()) as PipelineResponse & { baton?: string | null };
  for (const r of payload.results) {
    if (r.type === 'error') throw new Error(`Turso error: ${r.error.message}`);
  }
  return { baton: payload.baton ?? null, results: payload.results };
}

function extractExecute(result: PipelineResponse['results'][number]): ExecuteResult {
  if (result.type !== 'ok' || result.response.type !== 'execute') {
    throw new Error('Expected execute response');
  }
  const r = result.response.result;
  const columns = r.cols.map((c) => c.name);
  return {
    columns,
    rows: r.rows.map((row) => coerceRow(r.cols, row)),
    rowsAffected: r.affected_row_count ?? 0,
    lastInsertRowid: r.last_insert_rowid ? BigInt(r.last_insert_rowid) : null,
  };
}

function toExecuteRequest(input: ExecuteArgs | string) {
  const stmt =
    typeof input === 'string'
      ? { sql: input, args: [] as SqlArg[] }
      : { sql: input.sql, args: [...(input.args ?? [])] };
  return { type: 'execute' as const, stmt: { sql: stmt.sql, args: stmt.args.map(coerceArg) } };
}

class Transaction {
  private baton: string | null = null;
  private closed = false;
  constructor(
    private readonly base: string,
    private readonly authToken: string | undefined,
    initialBaton: string | null
  ) {
    this.baton = initialBaton;
  }

  async execute(input: ExecuteArgs | string): Promise<ExecuteResult> {
    if (this.closed) throw new Error('Transaction is closed');
    const { baton, results } = await runPipeline(this.base, this.authToken, this.baton, [
      toExecuteRequest(input),
    ]);
    this.baton = baton;
    return extractExecute(results[0]);
  }

  async commit(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await runPipeline(this.base, this.authToken, this.baton, [
      toExecuteRequest('COMMIT'),
      { type: 'close' },
    ]);
  }

  async rollback(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      await runPipeline(this.base, this.authToken, this.baton, [
        toExecuteRequest('ROLLBACK'),
        { type: 'close' },
      ]);
    } catch {
      // best-effort rollback
    }
  }
}

class TursoHttpClient {
  constructor(
    private readonly base: string,
    private readonly authToken?: string
  ) {}

  async execute(input: ExecuteArgs | string): Promise<ExecuteResult> {
    const { results } = await runPipeline(this.base, this.authToken, null, [
      toExecuteRequest(input),
      { type: 'close' },
    ]);
    return extractExecute(results[0]);
  }

  async transaction(_mode: 'read' | 'write' | 'deferred' = 'write'): Promise<Transaction> {
    void _mode;
    const { baton } = await runPipeline(this.base, this.authToken, null, [
      toExecuteRequest('BEGIN'),
    ]);
    return new Transaction(this.base, this.authToken, baton);
  }
}

export const db = new TursoHttpClient(
  httpUrlFromLibsqlUrl(process.env.TURSO_DATABASE_URL),
  process.env.TURSO_AUTH_TOKEN
);
