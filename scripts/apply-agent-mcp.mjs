#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://localhost:3000';
const PROTOCOL_VERSION = '2024-11-05';

const HELP = `
RolePatch apply-agent MCP server

Usage:
  ROLEPATCH_SESSION_COOKIE='better-auth.session_token=...' pnpm apply-agent:mcp

Environment:
  ROLEPATCH_SESSION_COOKIE   Required for tool calls. Existing better-auth cookie string.
  ROLEPATCH_BASE_URL         Optional. Defaults to ${DEFAULT_BASE_URL}.

Boundary:
  This server exposes review-first queue, packet, status, receipt, check, and
  guarded submit tools. Guarded submit refuses CAPTCHA, file uploads, missing
  required fields, unsupported providers, and a missing Browser binding.
`;

const TOOLS = [
  {
    name: 'rolepatch_queue_list',
    description: 'List the authenticated user application queue with readiness state.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_queue_add',
    description: 'Queue a tracked RolePatch job for reviewed application preparation.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Tracked job_applications id.' },
      },
      required: ['job_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_queue_status',
    description: 'Update an apply-agent queue item status.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'application_queue id.' },
        status: {
          type: 'string',
          enum: ['queued', 'needs_user', 'ready_to_submit', 'submitted', 'failed', 'skipped'],
        },
      },
      required: ['queue_id', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_queue_retry',
    description:
      'Retry a non-submitted apply-agent queue item after recomputing current readiness.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'application_queue id.' },
      },
      required: ['queue_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_queue_status_bulk',
    description: 'Bulk update apply-agent queue item statuses without submitting applications.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'application_queue ids.',
        },
        status: {
          type: 'string',
          enum: ['queued', 'needs_user', 'ready_to_submit', 'submitted', 'failed', 'skipped'],
        },
      },
      required: ['queue_ids', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_browser_check',
    description:
      'Run a reviewed browser check for a queued application and record an audit receipt. Does not submit.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'application_queue id.' },
      },
      required: ['queue_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_browser_check_batch',
    description:
      'Run reviewed browser checks for selected or recent queued applications. Does not submit.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_ids: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional application_queue ids. If omitted, recent eligible queue entries are used.',
        },
        limit: {
          type: 'number',
          description: 'Maximum entries to check, capped server-side.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_browser_submit',
    description:
      'Run guarded Cloudflare Browser Rendering submit for one ready queue item. Refuses CAPTCHA, file uploads, missing required fields, unsupported providers, and missing Browser binding.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'application_queue id.' },
      },
      required: ['queue_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_browser_submit_batch',
    description:
      'Run guarded Cloudflare Browser Rendering submit for selected or recent ready queue entries. Refuses CAPTCHA, file uploads, missing required fields, unsupported providers, and missing Browser binding.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_ids: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional ready application_queue ids. If omitted, recent ready queue entries are used.',
        },
        limit: {
          type: 'number',
          description: 'Maximum ready entries to submit, capped server-side.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_packets_list',
    description: 'Read prepared application packets, optionally filtered by job ids.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Single job id filter.' },
        job_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Multiple job id filter.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_receipts_list',
    description: 'Read application receipts, optionally filtered by job ids.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Single job id filter.' },
        job_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Multiple job id filter.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'rolepatch_receipts_record',
    description: 'Record a reviewed manual submission receipt for a queued application.',
    inputSchema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'application_queue id.' },
        confirmation_text: { type: 'string' },
        confirmation_url: { type: 'string' },
      },
      required: ['queue_id'],
      additionalProperties: false,
    },
  },
];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(HELP.trim());
  process.exit(0);
}

function requireString(args, key) {
  const value = args?.[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requireStringArray(args, key) {
  const value = args?.[key];
  if (!Array.isArray(value)) throw new Error(`${key} is required`);
  const strings = value.filter((item) => typeof item === 'string' && item.trim());
  if (strings.length === 0) throw new Error(`${key} must include at least one value`);
  return strings;
}

function jobFilterParams(args = {}) {
  const params = new URLSearchParams();
  if (typeof args.job_id === 'string' && args.job_id.trim()) {
    params.append('job_id', args.job_id);
  }
  if (Array.isArray(args.job_ids)) {
    const ids = args.job_ids.filter((id) => typeof id === 'string' && id.trim());
    if (ids.length) params.set('job_ids', ids.join(','));
  }
  return params;
}

function buildUrl(path, params = new URLSearchParams()) {
  const base = (process.env.ROLEPATCH_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = new URL(path, base);
  for (const [key, value] of params.entries()) {
    url.searchParams.append(key, value);
  }
  return url.toString();
}

async function request(path, { method = 'GET', body, params } = {}) {
  const cookie = process.env.ROLEPATCH_SESSION_COOKIE || process.env.ROLEPATCH_COOKIE;
  if (!cookie) {
    return {
      ok: false,
      status: 401,
      data: {
        error:
          'ROLEPATCH_SESSION_COOKIE is required. Copy the existing RolePatch better-auth cookie.',
      },
    };
  }

  const res = await fetch(buildUrl(path, params), {
    method,
    headers: {
      cookie,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { ok: res.ok, status: res.status, data };
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'rolepatch_queue_list':
      return request('/api/apply-agent/queue');
    case 'rolepatch_queue_add':
      return request('/api/apply-agent/queue', {
        method: 'POST',
        body: { job_id: requireString(args, 'job_id') },
      });
    case 'rolepatch_queue_status':
      return request(
        `/api/apply-agent/queue/${encodeURIComponent(requireString(args, 'queue_id'))}`,
        {
          method: 'PATCH',
          body: { status: requireString(args, 'status') },
        }
      );
    case 'rolepatch_queue_retry':
      return request(
        `/api/apply-agent/queue/${encodeURIComponent(requireString(args, 'queue_id'))}`,
        {
          method: 'POST',
          body: { action: 'retry' },
        }
      );
    case 'rolepatch_queue_status_bulk':
      return request('/api/apply-agent/queue', {
        method: 'PATCH',
        body: {
          queue_ids: requireStringArray(args, 'queue_ids'),
          status: requireString(args, 'status'),
        },
      });
    case 'rolepatch_browser_check':
      return request('/api/apply-agent/browser-check', {
        method: 'POST',
        body: { queue_id: requireString(args, 'queue_id') },
      });
    case 'rolepatch_browser_check_batch':
      return request('/api/apply-agent/browser-check', {
        method: 'POST',
        body: {
          queue_ids: Array.isArray(args.queue_ids)
            ? args.queue_ids.filter((id) => typeof id === 'string' && id.trim())
            : undefined,
          limit: typeof args.limit === 'number' ? args.limit : 5,
        },
      });
    case 'rolepatch_browser_submit':
      return request('/api/apply-agent/browser-submit', {
        method: 'POST',
        body: { queue_id: requireString(args, 'queue_id') },
      });
    case 'rolepatch_browser_submit_batch':
      return request('/api/apply-agent/browser-submit', {
        method: 'POST',
        body: {
          queue_ids: Array.isArray(args.queue_ids)
            ? args.queue_ids.filter((id) => typeof id === 'string' && id.trim())
            : undefined,
          limit: typeof args.limit === 'number' ? args.limit : 3,
        },
      });
    case 'rolepatch_packets_list':
      return request('/api/apply-agent/packets', { params: jobFilterParams(args) });
    case 'rolepatch_receipts_list':
      return request('/api/apply-agent/receipts', { params: jobFilterParams(args) });
    case 'rolepatch_receipts_record':
      return request('/api/apply-agent/receipts', {
        method: 'POST',
        body: {
          queue_id: requireString(args, 'queue_id'),
          confirmation_text:
            typeof args.confirmation_text === 'string' ? args.confirmation_text : undefined,
          confirmation_url:
            typeof args.confirmation_url === 'string' ? args.confirmation_url : undefined,
        },
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function toolResult(result) {
  return {
    content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    isError: !result.ok,
  };
}

async function handleRequest(message) {
  switch (message.method) {
    case 'initialize':
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'rolepatch-apply-agent', version: '0.1.0' },
      };
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call': {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      if (typeof name !== 'string') throw new Error('params.name is required');
      return toolResult(await callTool(name, args));
    }
    case 'shutdown':
      return null;
    default:
      throw jsonRpcError(-32601, `Method not found: ${message.method}`);
  }
}

function jsonRpcError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function writeMessage(payload) {
  const json = JSON.stringify(payload);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`);
}

async function dispatch(message) {
  const hasId = Object.hasOwn(message, 'id');

  if (!hasId) {
    if (message.method === 'notifications/initialized' || message.method === 'exit') return;
    try {
      await handleRequest(message);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
    }
    return;
  }

  try {
    const result = await handleRequest(message);
    writeMessage({ jsonrpc: '2.0', id: message.id, result });
  } catch (err) {
    writeMessage({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: Number.isInteger(err?.code) ? err.code : -32603,
        message: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

let input = Buffer.alloc(0);

function processInput() {
  while (input.length) {
    const headerEnd = input.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;

    const header = input.subarray(0, headerEnd).toString('utf8');
    const match = /^Content-Length:\s*(\d+)$/im.exec(header);
    if (!match) {
      console.error('Invalid MCP frame: missing Content-Length header');
      input = Buffer.alloc(0);
      return;
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (input.length < bodyEnd) return;

    const body = input.subarray(bodyStart, bodyEnd).toString('utf8');
    input = input.subarray(bodyEnd);

    try {
      void dispatch(JSON.parse(body));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
    }
  }
}

process.stdin.on('data', (chunk) => {
  input = Buffer.concat([input, chunk]);
  processInput();
});

process.stdin.on('end', () => {
  process.exit(0);
});
