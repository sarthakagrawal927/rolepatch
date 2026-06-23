/**
 * Native job search — runs in-Worker, no Python sidecar.
 *
 * Sources LinkedIn's public guest job-search endpoint (no auth, no API key)
 * and normalises the results into the shape the job-discovery UI expects.
 * Replaces the former `api/python/jobs-search.py` JobSpy wrapper, which could
 * not run on Cloudflare Workers (no Python runtime).
 */

export interface JobRecord {
  id: string;
  site: string;
  title: string;
  company: string;
  location: string | null;
  is_remote: boolean;
  date_posted: string | null;
  job_type: string | null;
  min_amount: number | null;
  max_amount: number | null;
  currency: string | null;
  job_url: string | null;
  description: string | null;
  description_short: string | null;
  company_url: string | null;
  emails: string | null;
}

export interface JobSearchParams {
  query: string;
  location?: string | null;
  remote?: boolean;
  /** Soft cap on how many postings to return (default 25, max 100). */
  results_wanted?: number;
  /** Only postings newer than this many hours (default 168 = 7 days). */
  hours_old?: number;
}

const LINKEDIN_GUEST_URL = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const PAGE_SIZE = 10;
const MAX_PAGES = 12;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

type Doc = { querySelectorAll: (sel: string) => ArrayLike<JobElement> };
type JobElement = { querySelector: (sel: string) => JobNode | null };
type JobNode = {
  textContent: string | null;
  getAttribute: (name: string) => string | null;
};

/** Stable 16-char id derived from the posting URL (mirrors the old sha1 id). */
function jobId(seed: string): string {
  const fnv = (h: number): string => {
    let x = h >>> 0;
    for (let i = 0; i < seed.length; i++) {
      x ^= seed.charCodeAt(i);
      x = Math.imul(x, 0x01000193);
    }
    return (x >>> 0).toString(16).padStart(8, '0');
  };
  return fnv(0x811c9dc5) + fnv(0x9dc5811c);
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.replace(/\s+/g, ' ').trim();
  return s.length > 0 ? s : null;
}

function text(el: JobElement, sel: string): string | null {
  return clean(el.querySelector(sel)?.textContent);
}

function attr(el: JobElement, sel: string, name: string): string | null {
  return clean(el.querySelector(sel)?.getAttribute(name));
}

async function parseCards(html: string): Promise<JobElement[]> {
  const { parseHTML } = (await import('linkedom')) as {
    parseHTML: (h: string) => { document: Doc };
  };
  const { document } = parseHTML(html);
  return Array.from(document.querySelectorAll('li'));
}

function toRecord(el: JobElement, remoteRequested: boolean): JobRecord | null {
  const rawUrl =
    attr(el, 'a.base-card__full-link', 'href') ?? attr(el, 'a[href*="/jobs/view/"]', 'href');
  const jobUrl = rawUrl ? rawUrl.split('?')[0] : null;

  const title = text(el, '.base-search-card__title');
  const company = text(el, '.base-search-card__subtitle');
  if (!title && !jobUrl) return null;

  const location = text(el, '.job-search-card__location');
  return {
    id: jobId(jobUrl ?? `${title ?? ''}-${company ?? ''}`),
    site: 'linkedin',
    title: title ?? 'Untitled role',
    company: company ?? 'Unknown company',
    location,
    is_remote: remoteRequested || /\bremote\b/i.test(location ?? ''),
    date_posted: attr(el, 'time', 'datetime'),
    job_type: null,
    min_amount: null,
    max_amount: null,
    currency: null,
    job_url: jobUrl,
    description: null,
    description_short: null,
    company_url: attr(el, '.base-search-card__subtitle a', 'href')?.split('?')[0] ?? null,
    emails: null,
  };
}

/**
 * Search jobs via LinkedIn's public guest endpoint. Paginates until
 * `results_wanted` is reached or results run out. Throws if the very first
 * request fails so the caller can surface a 502.
 */
export async function searchJobs(params: JobSearchParams): Promise<{ jobs: JobRecord[] }> {
  const query = params.query.trim();
  if (!query) return { jobs: [] };

  const wanted = Math.min(Math.max(params.results_wanted ?? 25, 1), 100);
  const hoursOld = Math.max(params.hours_old ?? 168, 1);
  const remote = Boolean(params.remote);

  const base = new URLSearchParams({ keywords: query });
  if (params.location) base.set('location', params.location.trim());
  base.set('f_TPR', `r${hoursOld * 3600}`);
  if (remote) base.set('f_WT', '2');

  const seen = new Set<string>();
  const jobs: JobRecord[] = [];

  for (let page = 0; page < MAX_PAGES && jobs.length < wanted; page++) {
    base.set('start', String(page * PAGE_SIZE));
    let html: string;
    try {
      const res = await fetch(`${LINKEDIN_GUEST_URL}?${base.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        if (page === 0) throw new Error(`LinkedIn returned HTTP ${res.status}`);
        break;
      }
      html = await res.text();
    } catch (err) {
      if (page === 0) throw err;
      break;
    }

    const cards = await parseCards(html);
    if (cards.length === 0) break;

    for (const card of cards) {
      const rec = toRecord(card, remote);
      const key = rec?.job_url ?? rec?.id;
      if (!rec || !key || seen.has(key)) continue;
      seen.add(key);
      jobs.push(rec);
    }
  }

  return { jobs: jobs.slice(0, wanted) };
}
