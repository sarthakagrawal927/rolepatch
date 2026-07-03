import {
  APPLY_PACKET_ENDPOINT,
  FILL_RECEIPT_ENDPOINT,
  getApiBase,
  SAVE_JOB_ENDPOINT,
  SUBMISSION_RECEIPT_ENDPOINT,
  TAILOR_ENDPOINT,
} from './config';
import type { ExtensionApiResponse, ExtensionMessage, ScrapedJob, TailorResponse } from './types';

// better-auth issues slightly different cookie names depending on deployment.
// Try common local and secure names so both localhost and prod work.
const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
  'better-auth-session_token',
  '__Secure-better-auth-session_token',
];

async function getSessionCookie(apiBase: string): Promise<string | null> {
  for (const name of SESSION_COOKIE_NAMES) {
    const cookie = await chrome.cookies.get({ url: apiBase, name });
    if (cookie?.value) return `${name}=${cookie.value}`;
  }
  return null;
}

async function apiRequest<T extends ExtensionApiResponse>(
  endpoint: string,
  body: unknown
): Promise<T> {
  const apiBase = await getApiBase();
  const cookieHeader = await getSessionCookie(apiBase);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // Fetch from a service worker will not reliably attach cross-origin cookies.
  // Forward the session in a header that RolePatch extension routes accept.
  if (cookieHeader) headers['x-rolepatch-session'] = cookieHeader;

  const res = await fetch(`${apiBase}${endpoint}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? `HTTP ${res.status}`,
      redirect_url: data.redirect_url,
    } as T;
  }
  return data;
}

async function postTailor(job: ScrapedJob): Promise<TailorResponse> {
  try {
    return await apiRequest<TailorResponse>(TAILOR_ENDPOINT, {
      url: job.url,
      title: job.title,
      company: job.company,
      jd_text: job.description,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function postSaveJob(job: ScrapedJob): Promise<ExtensionApiResponse> {
  try {
    return await apiRequest<ExtensionApiResponse>(SAVE_JOB_ENDPOINT, {
      url: job.url,
      title: job.title,
      company: job.company,
      jd_text: job.description,
      queue: true,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchApplyPacket(url: string): Promise<ExtensionApiResponse> {
  try {
    return await apiRequest<ExtensionApiResponse>(APPLY_PACKET_ENDPOINT, { url });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function postFillReceipt(payload: unknown): Promise<ExtensionApiResponse> {
  try {
    return await apiRequest<ExtensionApiResponse>(FILL_RECEIPT_ENDPOINT, payload);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function postSubmissionReceipt(payload: unknown): Promise<ExtensionApiResponse> {
  try {
    return await apiRequest<ExtensionApiResponse>(SUBMISSION_RECEIPT_ENDPOINT, payload);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'SAVE_JOB') {
    postSaveJob(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'TAILOR_JOB') {
    postTailor(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'FETCH_APPLY_PACKET') {
    fetchApplyPacket(message.payload.url).then(sendResponse);
    return true;
  }
  if (message.type === 'RECORD_FILL_RECEIPT') {
    postFillReceipt(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'RECORD_SUBMISSION_RECEIPT') {
    postSubmissionReceipt(message.payload).then(sendResponse);
    return true;
  }
  return undefined;
});
