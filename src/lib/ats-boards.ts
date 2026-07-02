/**
 * ATS board detection + metadata extraction.
 *
 * Supports the 10 major applicant tracking systems that Google indexes
 * via `site:` queries. Used by the scrape flow to extract company names
 * and board-specific identifiers from pasted job URLs.
 *
 * Supported boards:
 *   Ashby, Greenhouse, Lever, iCIMS, Jobvite, Workday,
 *   BambooHR, SmartRecruiters, Jazz, Workable
 */

export interface AtsBoardInfo {
  /** Canonical board identifier, e.g. "ashby", "greenhouse". */
  board: string;
  /** Extracted company slug/name from the URL, or null if not found. */
  company: string | null;
  /** Human-readable board name for display, e.g. "Ashby", "Greenhouse". */
  boardName: string;
}

interface BoardRule {
  board: string;
  boardName: string;
  /** Regex that matches the board's URL hostname. */
  hostPattern: RegExp;
  /** Extracts the company slug from a URL. */
  extractCompany: (url: URL) => string | null;
}

const BOARD_RULES: BoardRule[] = [
  {
    board: 'ashby',
    boardName: 'Ashby',
    hostPattern: /jobs\.ashbyhq\.com/i,
    // jobs.ashbyhq.com/<company-slug>  OR  jobs.ashbyhq.com/a/<company-slug>
    extractCompany: (url) => {
      const segs = url.pathname.split('/').filter(Boolean);
      // /a/<company>/<job-id>  →  company is segs[1]
      if (segs[0] === 'a' && segs[1]) return segs[1];
      // /<company>/<job-id>
      if (segs[0] && segs[0] !== 'a') return segs[0];
      return null;
    },
  },
  {
    board: 'greenhouse',
    boardName: 'Greenhouse',
    hostPattern: /boards\.greenhouse\.io|greenhouse\.io/i,
    // boards.greenhouse.io/<company>  OR  <company>.greenhouse.io
    extractCompany: (url) => {
      const sub = url.hostname.match(/^([^.]+)\.greenhouse\.io$/i);
      if (sub && sub[1] !== 'boards') return sub[1];
      const segs = url.pathname.split('/').filter(Boolean);
      return segs[0] ?? null;
    },
  },
  {
    board: 'lever',
    boardName: 'Lever',
    hostPattern: /jobs\.lever\.co/i,
    // jobs.lever.co/<company>/<job-id>
    extractCompany: (url) => {
      const segs = url.pathname.split('/').filter(Boolean);
      return segs[0] ?? null;
    },
  },
  {
    board: 'icims',
    boardName: 'iCIMS',
    hostPattern: /\.icims\.com$|careers\.icims\.com/i,
    // careers.icims.com/jobs/<job-id>?...  — company is usually a query param
    // or subdomain. iCIMS URLs don't embed company in the path reliably.
    extractCompany: (url) => {
      const sub = url.hostname.match(/^([^.]+)\.icims\.com$/i);
      if (sub && sub[1] !== 'careers') return sub[1];
      return null;
    },
  },
  {
    board: 'jobvite',
    boardName: 'Jobvite',
    hostPattern: /jobs\.jobvite\.com/i,
    // jobs.jobvite.com/<company>/...
    extractCompany: (url) => {
      const segs = url.pathname.split('/').filter(Boolean);
      return segs[0] ?? null;
    },
  },
  {
    board: 'workday',
    boardName: 'Workday',
    hostPattern: /wd1\.myworkdayjobs\.com|myworkdayjobs\.com/i,
    // wd1.myworkdayjobs.com/en-US/<company>/...
    extractCompany: (url) => {
      const segs = url.pathname.split('/').filter(Boolean);
      // Skip locale segment (en-US, etc.)
      const start = segs[0] && /^[a-z]{2}-[A-Z]{2}$/i.test(segs[0]) ? 1 : 0;
      return segs[start] ?? null;
    },
  },
  {
    board: 'bamboohr',
    boardName: 'BambooHR',
    hostPattern: /bamboohr\.com/i,
    // jobs.bamboohr.com/<company>/  OR  <company>.bamboohr.com/jobs/
    extractCompany: (url) => {
      const sub = url.hostname.match(/^([^.]+)\.bamboohr\.com$/i);
      if (sub && sub[1] !== 'jobs') return sub[1];
      const segs = url.pathname.split('/').filter(Boolean);
      if (segs[0] === 'jobs' && segs[1]) return segs[1];
      return segs[0] ?? null;
    },
  },
  {
    board: 'smartrecruiters',
    boardName: 'SmartRecruiters',
    hostPattern: /jobs\.smartrecruiters\.com/i,
    // jobs.smartrecruiters.com/<company>/...
    extractCompany: (url) => {
      const segs = url.pathname.split('/').filter(Boolean);
      return segs[0] ?? null;
    },
  },
  {
    board: 'jazz',
    boardName: 'JazzHR',
    hostPattern: /apply\.jazz\.co/i,
    // apply.jazz.co/<company>/...
    extractCompany: (url) => {
      const segs = url.pathname.split('/').filter(Boolean);
      return segs[0] ?? null;
    },
  },
  {
    board: 'workable',
    boardName: 'Workable',
    hostPattern: /workable\.com/i,
    // careers.workable.com/<company>  OR  <company>.workable.com
    extractCompany: (url) => {
      const sub = url.hostname.match(/^([^.]+)\.workable\.com$/i);
      if (sub && sub[1] !== 'careers') return sub[1];
      const segs = url.pathname.split('/').filter(Boolean);
      return segs[0] ?? null;
    },
  },
];

/** All supported board identifiers, in priority order. */
export const ATS_BOARDS = BOARD_RULES.map((r) => r.board);

/** Human-readable list of board names for UI display. */
export const ATS_BOARD_NAMES = BOARD_RULES.map((r) => r.boardName);

/**
 * Detect the ATS board from a URL and extract company metadata.
 * Returns null if the URL doesn't match any known board.
 */
export function detectAtsBoard(rawUrl: string): AtsBoardInfo | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  for (const rule of BOARD_RULES) {
    if (rule.hostPattern.test(parsed.hostname)) {
      return {
        board: rule.board,
        boardName: rule.boardName,
        company: rule.extractCompany(parsed),
      };
    }
  }
  return null;
}

/**
 * Normalize a company slug into a human-readable name.
 * "acme-corp" → "Acme Corp", "acme_corp" → "Acme Corp".
 */
export function slugToCompanyName(slug: string | null): string | null {
  if (!slug) return null;
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
