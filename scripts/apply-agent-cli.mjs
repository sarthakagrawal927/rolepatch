#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://localhost:3000';

const COMMANDS = `
RolePatch apply-agent CLI

Usage:
  pnpm apply-agent -- queue:list
  pnpm apply-agent -- queue:add <job_id>
  pnpm apply-agent -- queue:status <queue_id> <status>
  pnpm apply-agent -- queue:retry <queue_id>
  pnpm apply-agent -- queue:status:bulk <status> --queue-ids <a,b>
  pnpm apply-agent -- browser:check <queue_id>
  pnpm apply-agent -- browser:check:batch [--queue-ids <a,b>] [--limit <n>]
  pnpm apply-agent -- browser:submit <queue_id>
  pnpm apply-agent -- browser:submit:batch [--queue-ids <a,b>] [--limit <n>]
  pnpm apply-agent -- packets:list [--job-id <id>] [--job-ids <a,b>]
  pnpm apply-agent -- receipts:list [--job-id <id>] [--job-ids <a,b>]
  pnpm apply-agent -- receipts:record <queue_id> [--text <text>] [--url <url>]

Environment:
  ROLEPATCH_SESSION_COOKIE   Required. Existing better-auth cookie string.
  ROLEPATCH_BASE_URL         Optional. Defaults to ${DEFAULT_BASE_URL}.

Boundary:
  This CLI queues, reads packets, changes queue status, records reviewed receipts,
  and can run guarded Browser Rendering submit commands. Guarded submit refuses
  CAPTCHA, file uploads, missing required fields, unsupported providers, and a
  missing Browser binding.
`;

function die(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function argValue(args, name) {
  const idx = args.indexOf(name);
  if (idx < 0) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) die(`${name} requires a value`);
  return value;
}

function buildUrl(path, args) {
  const base = (process.env.ROLEPATCH_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = new URL(path, base);
  const jobId = argValue(args, '--job-id');
  const jobIds = argValue(args, '--job-ids');
  if (jobId) url.searchParams.append('job_id', jobId);
  if (jobIds) url.searchParams.set('job_ids', jobIds);
  return url.toString();
}

async function request(path, { method = 'GET', body, args = [] } = {}) {
  const cookie = process.env.ROLEPATCH_SESSION_COOKIE || process.env.ROLEPATCH_COOKIE;
  if (!cookie) {
    die('ROLEPATCH_SESSION_COOKIE is required. Copy the existing RolePatch better-auth cookie.');
  }
  const res = await fetch(buildUrl(path, args), {
    method,
    headers: {
      cookie,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error(JSON.stringify(json, null, 2));
    process.exit(res.status >= 500 ? 2 : 1);
  }
  console.log(JSON.stringify(json, null, 2));
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === '--') rawArgs.shift();
  const [command, ...args] = rawArgs;
  if (!command || command === '--help' || command === '-h') {
    console.log(COMMANDS.trim());
    return;
  }

  switch (command) {
    case 'queue:list':
      return request('/api/apply-agent/queue');
    case 'queue:add': {
      const [jobId] = args;
      if (!jobId) die('queue:add requires <job_id>');
      return request('/api/apply-agent/queue', { method: 'POST', body: { job_id: jobId } });
    }
    case 'queue:status': {
      const [queueId, status] = args;
      if (!queueId || !status) die('queue:status requires <queue_id> <status>');
      return request(`/api/apply-agent/queue/${encodeURIComponent(queueId)}`, {
        method: 'PATCH',
        body: { status },
      });
    }
    case 'queue:retry': {
      const [queueId] = args;
      if (!queueId) die('queue:retry requires <queue_id>');
      return request(`/api/apply-agent/queue/${encodeURIComponent(queueId)}`, {
        method: 'POST',
        body: { action: 'retry' },
      });
    }
    case 'queue:status:bulk': {
      const [status] = args;
      const queueIds = argValue(args, '--queue-ids')
        ?.split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (!status || !queueIds?.length) {
        die('queue:status:bulk requires <status> --queue-ids <a,b>');
      }
      return request('/api/apply-agent/queue', {
        method: 'PATCH',
        body: { status, queue_ids: queueIds },
      });
    }
    case 'browser:check': {
      const [queueId] = args;
      if (!queueId) die('browser:check requires <queue_id>');
      return request('/api/apply-agent/browser-check', {
        method: 'POST',
        body: { queue_id: queueId },
      });
    }
    case 'browser:check:batch': {
      const queueIds = argValue(args, '--queue-ids')
        ?.split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const limitRaw = argValue(args, '--limit');
      return request('/api/apply-agent/browser-check', {
        method: 'POST',
        body: {
          queue_ids: queueIds,
          limit: limitRaw ? Number(limitRaw) : 5,
        },
      });
    }
    case 'browser:submit': {
      const [queueId] = args;
      if (!queueId) die('browser:submit requires <queue_id>');
      return request('/api/apply-agent/browser-submit', {
        method: 'POST',
        body: { queue_id: queueId },
      });
    }
    case 'browser:submit:batch': {
      const queueIds = argValue(args, '--queue-ids')
        ?.split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const limitRaw = argValue(args, '--limit');
      return request('/api/apply-agent/browser-submit', {
        method: 'POST',
        body: {
          queue_ids: queueIds,
          limit: limitRaw ? Number(limitRaw) : 3,
        },
      });
    }
    case 'packets:list':
      return request('/api/apply-agent/packets', { args });
    case 'receipts:list':
      return request('/api/apply-agent/receipts', { args });
    case 'receipts:record': {
      const [queueId] = args;
      if (!queueId) die('receipts:record requires <queue_id>');
      return request('/api/apply-agent/receipts', {
        method: 'POST',
        body: {
          queue_id: queueId,
          confirmation_text: argValue(args, '--text') ?? undefined,
          confirmation_url: argValue(args, '--url') ?? undefined,
        },
      });
    }
    default:
      die(`Unknown command: ${command}\n\n${COMMANDS.trim()}`);
  }
}

main().catch((err) => die(err instanceof Error ? err.message : String(err), 2));
