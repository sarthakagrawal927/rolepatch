import type { DiscoveredJob } from '@/lib/job-discovery-types';
import type { CompanyWatch } from '@/lib/types';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export type CareerDiscoverySource =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'recruitee'
  | 'personio'
  | 'smartrecruiters'
  | 'career_page';

export interface CareerDiscoveryResult {
  jobs: DiscoveredJob[];
  source: CareerDiscoverySource;
}

interface GreenhouseJob {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  location?: { name?: string };
  updated_at?: string;
}

interface LeverJob {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
}

interface AshbyJob {
  title?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  employmentType?: string;
  jobUrl?: string;
  applyUrl?: string;
}

interface WorkableJob {
  id?: string;
  title?: string;
  full_title?: string;
  shortcode?: string;
  state?: string;
  department?: string;
  url?: string;
  application_url?: string;
  shortlink?: string;
  description?: string;
  created_at?: string;
  location?: {
    location_str?: string;
    city?: string;
    country?: string;
    telecommuting?: boolean;
    workplace_type?: string;
  };
  salary?: {
    salary_from?: number;
    salary_to?: number;
    salary_currency?: string;
  };
}

interface RecruiteeOffer {
  id?: number | string;
  title?: string;
  slug?: string;
  careers_url?: string;
  url?: string;
  location?: string;
  city?: string;
  country?: string;
  department?: string;
  description?: string;
  remote?: boolean;
  created_at?: string;
  status?: string;
}

interface SmartRecruitersPosting {
  id?: string;
  uuid?: string;
  name?: string;
  releasedDate?: string;
  postingUrl?: string;
  applyUrl?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  department?: {
    label?: string;
    name?: string;
  };
  function?: {
    label?: string;
  };
  typeOfEmployment?: {
    label?: string;
  };
}

type LinkedomDocument = {
  querySelectorAll: (selector: string) => ArrayLike<LinkedomElement>;
  body?: { textContent?: string | null };
};

type LinkedomElement = {
  textContent?: string | null;
  getAttribute: (name: string) => string | null;
  querySelector?: (selector: string) => LinkedomElement | null;
};

function stableId(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `career_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function terms(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((term) => term.length > 2);
}

function matchesNeedle(job: DiscoveredJob, needle: string): boolean {
  const required = terms(needle);
  if (required.length === 0) return true;
  const haystack = [
    job.title,
    job.company,
    job.location,
    job.description_short,
    job.description,
    job.job_type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return required.every((term) => haystack.includes(term));
}

function filterJobs(jobs: DiscoveredJob[], watch: CompanyWatch): DiscoveredJob[] {
  const roleQuery = watch.role_query.trim();
  const location = watch.location.trim();
  return jobs
    .filter((job) => matchesNeedle(job, roleQuery))
    .filter((job) => matchesNeedle(job, location))
    .filter((job) => !watch.remote || job.is_remote || /\bremote\b/i.test(job.location ?? ''))
    .slice(0, 50);
}

function boardToken(url: URL): string | null {
  const first = url.pathname.split('/').filter(Boolean)[0];
  return first ? decodeURIComponent(first) : null;
}

function greenhouseToken(url: URL): string | null {
  if (!url.hostname.includes('greenhouse.io')) return null;
  return boardToken(url);
}

function leverToken(url: URL): string | null {
  if (!url.hostname.includes('lever.co')) return null;
  return boardToken(url);
}

function ashbyToken(url: URL): string | null {
  if (!url.hostname.includes('ashbyhq.com')) return null;
  return boardToken(url);
}

function workableToken(url: URL): string | null {
  if (!url.hostname.includes('workable.com')) return null;
  const first = boardToken(url);
  if (url.hostname === 'apply.workable.com' || url.hostname === 'www.workable.com') {
    return first && !['jobs', 'api'].includes(first) ? first : null;
  }
  const subdomain = url.hostname.split('.')[0];
  return subdomain && subdomain !== 'www' && subdomain !== 'apply' ? subdomain : first;
}

function recruiteeToken(url: URL): string | null {
  if (!url.hostname.includes('recruitee.com')) return null;
  const subdomain = url.hostname.split('.')[0];
  return subdomain && subdomain !== 'www' ? subdomain : boardToken(url);
}

function isPersonioHost(url: URL): boolean {
  return /(^|\.)jobs\.personio\.(com|de)$/i.test(url.hostname);
}

function smartRecruitersToken(url: URL): string | null {
  if (!url.hostname.includes('smartrecruiters.com')) return null;
  const first = boardToken(url);
  if (!first || ['jobs', 'careers', 'company'].includes(first.toLowerCase())) return null;
  return first;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Career source returned HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Career page returned HTTP ${res.status}`);
  return await res.text();
}

async function parseDocument(markup: string): Promise<LinkedomDocument> {
  const { parseHTML } = (await import('linkedom')) as {
    parseHTML: (html: string) => { document: LinkedomDocument };
  };
  return parseHTML(markup).document;
}

async function discoverGreenhouse(
  url: URL,
  watch: CompanyWatch
): Promise<CareerDiscoveryResult | null> {
  const token = greenhouseToken(url);
  if (!token) return null;
  const data = await fetchJson<{ jobs?: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=false`
  );
  const jobs = (data.jobs ?? [])
    .map((job): DiscoveredJob | null => {
      const jobUrl = clean(job.absolute_url);
      const title = clean(job.title);
      if (!jobUrl && !title) return null;
      const location = clean(job.location?.name);
      return {
        id: stableId(`greenhouse:${job.id ?? jobUrl ?? title}`),
        site: 'greenhouse',
        title: title ?? 'Untitled role',
        company: watch.company,
        location,
        is_remote: /\bremote\b/i.test(location ?? ''),
        date_posted: clean(job.updated_at),
        job_type: null,
        min_amount: null,
        max_amount: null,
        currency: null,
        job_url: jobUrl,
        description: null,
        description_short: null,
      };
    })
    .filter((job): job is DiscoveredJob => Boolean(job));
  return { source: 'greenhouse', jobs: filterJobs(jobs, watch) };
}

async function discoverLever(url: URL, watch: CompanyWatch): Promise<CareerDiscoveryResult | null> {
  const token = leverToken(url);
  if (!token) return null;
  const data = await fetchJson<LeverJob[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`
  );
  const jobs = data
    .map((job): DiscoveredJob | null => {
      const jobUrl = clean(job.hostedUrl ?? job.applyUrl);
      const title = clean(job.text);
      if (!jobUrl && !title) return null;
      const location = clean(job.categories?.location);
      const descriptionShort = clean(
        [job.categories?.team, job.categories?.commitment].filter(Boolean).join(' · ')
      );
      return {
        id: stableId(`lever:${job.id ?? jobUrl ?? title}`),
        site: 'lever',
        title: title ?? 'Untitled role',
        company: watch.company,
        location,
        is_remote: /\bremote\b/i.test(location ?? ''),
        date_posted: job.createdAt ? new Date(job.createdAt).toISOString() : null,
        job_type: clean(job.categories?.commitment),
        min_amount: null,
        max_amount: null,
        currency: null,
        job_url: jobUrl,
        description: null,
        description_short: descriptionShort,
      };
    })
    .filter((job): job is DiscoveredJob => Boolean(job));
  return { source: 'lever', jobs: filterJobs(jobs, watch) };
}

async function discoverAshby(url: URL, watch: CompanyWatch): Promise<CareerDiscoveryResult | null> {
  const token = ashbyToken(url);
  if (!token) return null;
  const data = await fetchJson<{ jobs?: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=false`
  );
  const jobs = (data.jobs ?? [])
    .filter((job) => job.isListed !== false)
    .map((job): DiscoveredJob | null => {
      const jobUrl = clean(job.jobUrl ?? job.applyUrl);
      const title = clean(job.title);
      if (!jobUrl && !title) return null;
      const secondaryLocations = (job.secondaryLocations ?? [])
        .map((location) => clean(location.location))
        .filter(Boolean);
      const location = clean([job.location, ...secondaryLocations].filter(Boolean).join(' · '));
      const descriptionShort = clean(
        [job.department, job.team, job.employmentType].filter(Boolean).join(' · ')
      );
      return {
        id: stableId(`ashby:${jobUrl ?? title}`),
        site: 'ashby',
        title: title ?? 'Untitled role',
        company: watch.company,
        location,
        is_remote:
          Boolean(job.isRemote) ||
          job.workplaceType === 'Remote' ||
          /\bremote\b/i.test(location ?? ''),
        date_posted: clean(job.publishedAt),
        job_type: clean(job.employmentType),
        min_amount: null,
        max_amount: null,
        currency: null,
        job_url: jobUrl,
        description: clean(job.descriptionPlain),
        description_short: descriptionShort,
      };
    })
    .filter((job): job is DiscoveredJob => Boolean(job));
  return { source: 'ashby', jobs: filterJobs(jobs, watch) };
}

async function discoverWorkable(
  url: URL,
  watch: CompanyWatch
): Promise<CareerDiscoveryResult | null> {
  const token = workableToken(url);
  if (!token) return null;
  const data = await fetchJson<{ jobs?: WorkableJob[] }>(
    `https://www.workable.com/api/accounts/${encodeURIComponent(token)}?details=true`
  );
  const jobs = (data.jobs ?? [])
    .filter((job) => !job.state || job.state === 'published')
    .map((job): DiscoveredJob | null => {
      const title = clean(job.title ?? job.full_title);
      const jobUrl = clean(job.url ?? job.shortlink ?? job.application_url);
      if (!jobUrl && !title) return null;
      const location = clean(
        job.location?.location_str ??
          [job.location?.city, job.location?.country].filter(Boolean).join(', ')
      );
      return {
        id: stableId(`workable:${job.id ?? job.shortcode ?? jobUrl ?? title}`),
        site: 'workable',
        title: title ?? 'Untitled role',
        company: watch.company,
        location,
        is_remote:
          Boolean(job.location?.telecommuting) ||
          job.location?.workplace_type === 'remote' ||
          /\bremote\b/i.test(location ?? ''),
        date_posted: clean(job.created_at),
        job_type: null,
        min_amount: job.salary?.salary_from ?? null,
        max_amount: job.salary?.salary_to ?? null,
        currency: clean(job.salary?.salary_currency),
        job_url: jobUrl,
        description: clean(job.description),
        description_short: clean(job.department),
      };
    })
    .filter((job): job is DiscoveredJob => Boolean(job));
  return { source: 'workable', jobs: filterJobs(jobs, watch) };
}

async function discoverRecruitee(
  url: URL,
  watch: CompanyWatch
): Promise<CareerDiscoveryResult | null> {
  const token = recruiteeToken(url);
  if (!token) return null;
  const data = await fetchJson<{ offers?: RecruiteeOffer[] } | RecruiteeOffer[]>(
    `https://${token}.recruitee.com/api/offers/`
  );
  const offers = Array.isArray(data) ? data : (data.offers ?? []);
  const jobs = offers
    .filter((offer) => !offer.status || offer.status === 'published')
    .map((offer): DiscoveredJob | null => {
      const title = clean(offer.title);
      const jobUrl = clean(
        offer.careers_url ??
          offer.url ??
          (offer.slug ? `https://${token}.recruitee.com/o/${offer.slug}` : null)
      );
      if (!jobUrl && !title) return null;
      const location = clean(
        offer.location ?? [offer.city, offer.country].filter(Boolean).join(', ')
      );
      return {
        id: stableId(`recruitee:${offer.id ?? offer.slug ?? jobUrl ?? title}`),
        site: 'recruitee',
        title: title ?? 'Untitled role',
        company: watch.company,
        location,
        is_remote: Boolean(offer.remote) || /\bremote\b/i.test(location ?? ''),
        date_posted: clean(offer.created_at),
        job_type: null,
        min_amount: null,
        max_amount: null,
        currency: null,
        job_url: jobUrl,
        description: clean(offer.description),
        description_short: clean(offer.department),
      };
    })
    .filter((job): job is DiscoveredJob => Boolean(job));
  return { source: 'recruitee', jobs: filterJobs(jobs, watch) };
}

function nodeText(node: LinkedomElement, selector: string): string | null {
  return clean(node.querySelector?.(selector)?.textContent);
}

async function discoverPersonio(
  url: URL,
  watch: CompanyWatch
): Promise<CareerDiscoveryResult | null> {
  if (!isPersonioHost(url)) return null;
  const xml = await fetchText(`${url.origin}/xml?language=en`);
  const document = await parseDocument(xml);
  const jobs = Array.from(document.querySelectorAll('position'))
    .map((position): DiscoveredJob | null => {
      const id = nodeText(position, 'id');
      const title = nodeText(position, 'name');
      const location = clean(
        [nodeText(position, 'office'), nodeText(position, 'location')].filter(Boolean).join(' · ')
      );
      const department =
        nodeText(position, 'department') ?? nodeText(position, 'recruitingCategory');
      const employmentType = nodeText(position, 'employmentType') ?? nodeText(position, 'schedule');
      const jobUrl = nodeText(position, 'jobUrl') ?? nodeText(position, 'url');
      if (!title && !jobUrl) return null;
      return {
        id: stableId(`personio:${id ?? jobUrl ?? title}`),
        site: 'personio',
        title: title ?? 'Untitled role',
        company: watch.company,
        location,
        is_remote: /\bremote\b/i.test(location ?? ''),
        date_posted: nodeText(position, 'createdAt') ?? nodeText(position, 'created_at'),
        job_type: employmentType,
        min_amount: null,
        max_amount: null,
        currency: null,
        job_url: jobUrl ?? url.toString(),
        description: clean(position.textContent),
        description_short: clean([department, employmentType].filter(Boolean).join(' · ')),
      };
    })
    .filter((job): job is DiscoveredJob => Boolean(job));
  return { source: 'personio', jobs: filterJobs(jobs, watch) };
}

async function discoverSmartRecruiters(
  url: URL,
  watch: CompanyWatch
): Promise<CareerDiscoveryResult | null> {
  const token = smartRecruitersToken(url);
  if (!token) return null;
  const data = await fetchJson<{ content?: SmartRecruitersPosting[] }>(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(token)}/postings?limit=100`
  );
  const jobs = (data.content ?? [])
    .map((posting): DiscoveredJob | null => {
      const title = clean(posting.name);
      const postingId = clean(posting.id ?? posting.uuid);
      const jobUrl = clean(
        posting.postingUrl ??
          posting.applyUrl ??
          (postingId
            ? `https://jobs.smartrecruiters.com/${encodeURIComponent(token)}/${encodeURIComponent(postingId)}`
            : null)
      );
      if (!title && !jobUrl) return null;
      const location = clean(
        [posting.location?.city, posting.location?.region, posting.location?.country]
          .filter(Boolean)
          .join(', ')
      );
      const descriptionShort = clean(
        [posting.department?.label ?? posting.department?.name, posting.function?.label]
          .filter(Boolean)
          .join(' · ')
      );
      return {
        id: stableId(`smartrecruiters:${postingId ?? jobUrl ?? title}`),
        site: 'smartrecruiters',
        title: title ?? 'Untitled role',
        company: watch.company,
        location,
        is_remote: Boolean(posting.location?.remote) || /\bremote\b/i.test(location ?? ''),
        date_posted: clean(posting.releasedDate),
        job_type: clean(posting.typeOfEmployment?.label),
        min_amount: null,
        max_amount: null,
        currency: null,
        job_url: jobUrl,
        description: null,
        description_short: descriptionShort,
      };
    })
    .filter((job): job is DiscoveredJob => Boolean(job));
  return { source: 'smartrecruiters', jobs: filterJobs(jobs, watch) };
}

async function parseHtmlLinks(
  html: string,
  baseUrl: string,
  company: string
): Promise<DiscoveredJob[]> {
  const document = await parseDocument(html);
  const seen = new Set<string>();
  const jobs: DiscoveredJob[] = [];

  for (const link of Array.from(document.querySelectorAll('a[href]'))) {
    const href = clean(link.getAttribute('href'));
    if (!href) continue;
    let jobUrl: string;
    try {
      jobUrl = new URL(href, baseUrl).toString().split('#')[0];
    } catch {
      continue;
    }
    const path = new URL(jobUrl).pathname;
    const title = clean(link.textContent) ?? clean(path.split('/').filter(Boolean).at(-1));
    const looksLikeJob =
      /job|career|opening|position|posting|greenhouse|lever|ashby|workday/i.test(jobUrl) ||
      /engineer|developer|designer|manager|sales|marketing|product|data|analyst|intern/i.test(
        title ?? ''
      );
    if (!title || !looksLikeJob || seen.has(jobUrl)) continue;
    seen.add(jobUrl);
    jobs.push({
      id: stableId(`career:${jobUrl}`),
      site: 'career_page',
      title,
      company,
      location: null,
      is_remote: /\bremote\b/i.test(title),
      date_posted: null,
      job_type: null,
      min_amount: null,
      max_amount: null,
      currency: null,
      job_url: jobUrl,
      description: null,
      description_short: null,
    });
  }

  return jobs;
}

async function discoverCareerPage(url: URL, watch: CompanyWatch): Promise<CareerDiscoveryResult> {
  const html = await fetchText(url.toString());
  const jobs = await parseHtmlLinks(html, url.toString(), watch.company);
  return { source: 'career_page', jobs: filterJobs(jobs, watch) };
}

export function supportsCareerUrl(careerUrl: string | null | undefined): boolean {
  if (!careerUrl) return false;
  try {
    const url = new URL(careerUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function discoverCompanyCareerJobs(
  watch: CompanyWatch
): Promise<CareerDiscoveryResult | null> {
  if (!supportsCareerUrl(watch.career_url)) return null;
  const url = new URL(watch.career_url as string);
  return (
    (await discoverGreenhouse(url, watch)) ??
    (await discoverLever(url, watch)) ??
    (await discoverAshby(url, watch)) ??
    (await discoverWorkable(url, watch)) ??
    (await discoverRecruitee(url, watch)) ??
    (await discoverPersonio(url, watch)) ??
    (await discoverSmartRecruiters(url, watch)) ??
    discoverCareerPage(url, watch)
  );
}
