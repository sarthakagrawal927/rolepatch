import { getApiBase, TAILOR_ENDPOINT } from './config';
import type { ExtensionMessage, ScrapedJob, TailorResponse } from './types';

// NextAuth issues slightly different cookie names depending on deployment
// (`next-auth.session-token` for http, `__Secure-next-auth.session-token`
// for https). Try both so both localhost and prod work.
const SESSION_COOKIE_NAMES = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
];

async function getSessionCookie(apiBase: string): Promise<string | null> {
  for (const name of SESSION_COOKIE_NAMES) {
    const cookie = await chrome.cookies.get({ url: apiBase, name });
    if (cookie?.value) return `${name}=${cookie.value}`;
  }
  return null;
}

async function postTailor(job: ScrapedJob): Promise<TailorResponse> {
  const apiBase = await getApiBase();
  const cookieHeader = await getSessionCookie(apiBase);

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // Fetch from a service worker won't attach cookies for cross-origin by
  // default — forward explicitly as a header the server can read.
  if (cookieHeader) headers['x-rolepatch-session'] = cookieHeader;

  try {
    const body = {
      url: job.url,
      title: job.title,
      company: job.company,
      jd_text: job.description,
    };
    const res = await fetch(`${apiBase}${TAILOR_ENDPOINT}`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as TailorResponse;
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `HTTP ${res.status}`,
        redirect_url: data.redirect_url,
      };
    }
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'TAILOR_JOB') {
      postTailor(message.payload).then(sendResponse);
      return true; // keep the channel open for async response
    }
    return undefined;
  },
);
