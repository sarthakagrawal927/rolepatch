'use client';

import { ChevronDown, ExternalLink, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ATS_BOARDS } from '@/lib/ats-boards';

interface BoardOption {
  board: string;
  site: string;
  label: string;
}

const ALL_BOARDS: BoardOption[] = [
  { board: 'ashby', site: 'jobs.ashbyhq.com', label: 'Ashby' },
  { board: 'greenhouse', site: 'boards.greenhouse.io', label: 'Greenhouse' },
  { board: 'lever', site: 'jobs.lever.co', label: 'Lever' },
  { board: 'icims', site: 'careers.icims.com', label: 'iCIMS' },
  { board: 'jobvite', site: 'jobs.jobvite.com', label: 'Jobvite' },
  { board: 'workday', site: 'wd1.myworkdayjobs.com', label: 'Workday' },
  { board: 'bamboohr', site: 'jobs.bamboohr.com', label: 'BambooHR' },
  { board: 'smartrecruiters', site: 'jobs.smartrecruiters.com', label: 'SmartRecruiters' },
  { board: 'jazz', site: 'apply.jazz.co', label: 'JazzHR' },
  { board: 'workable', site: 'careers.workable.com', label: 'Workable' },
];

const DEFAULT_BOARDS = new Set(['ashby', 'greenhouse', 'lever']);

/**
 * Build a Google search URL with site: operators for the selected boards.
 * Google supports OR between site: operators, so one query covers all boards.
 *
 * Example: site:jobs.ashbyhq.com OR site:boards.greenhouse.io "product manager"
 */
export function buildGoogleQuery(keywords: string, boards: Set<string>): string {
  const sites = ALL_BOARDS.filter((b) => boards.has(b.board)).map((b) => `site:${b.site}`);
  const siteExpr = sites.length > 1 ? sites.join(' OR ') : (sites[0] ?? '');
  const kw = keywords.trim();
  const query = [siteExpr, kw].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function JobSearchTips() {
  const [open, setOpen] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(DEFAULT_BOARDS);

  const googleUrl = useMemo(
    () => buildGoogleQuery(keywords, selectedBoards),
    [keywords, selectedBoards]
  );

  const hasBoards = selectedBoards.size > 0;

  function toggleBoard(board: string) {
    setSelectedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(board)) next.delete(board);
      else next.add(board);
      return next;
    });
  }

  function selectAll() {
    setSelectedBoards(new Set(ATS_BOARDS));
  }

  function selectNone() {
    setSelectedBoards(new Set());
  }

  return (
    <div className="rounded-2xl border border-[var(--border)]/60 bg-muted/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
          Find less-competitive jobs on ATS boards
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm text-[var(--muted-foreground)]">
          <p>
            Search company career pages directly — these roles get far fewer applicants than
            LinkedIn. We open Google in your browser with the right{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">site:</code> query; you copy
            the job URL and paste it into Add Job.
          </p>

          {/* Keywords input */}
          <div>
            <label
              htmlFor="ats-keywords"
              className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
            >
              Role, skill, or keyword
            </label>
            <input
              id="ats-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder='product manager, staff engineer, ("pm intern" OR "product intern")'
              className="input-base"
            />
            <p className="text-[10px] mt-1 italic">
              Tip: use boolean —{' '}
              <code className="text-[10px] bg-muted px-1 rounded">
                &quot;role A&quot; OR &quot;role B&quot;
              </code>
            </p>
          </div>

          {/* Board selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest">
                ATS boards ({selectedBoards.size}/{ALL_BOARDS.length})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[10px] text-[var(--primary)] hover:underline"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-[10px] text-[var(--muted-foreground)] hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_BOARDS.map((b) => {
                const active = selectedBoards.has(b.board);
                return (
                  <button
                    key={b.board}
                    type="button"
                    onClick={() => toggleBoard(b.board)}
                    className={`text-[10px] font-mono px-2.5 py-1 rounded-full transition-colors ${
                      active
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'bg-muted text-[var(--muted-foreground)] hover:bg-muted/80'
                    }`}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview the query */}
          {hasBoards && (
            <div className="rounded-lg bg-background border border-[var(--border)]/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2">
                Google query preview
              </p>
              <pre className="text-xs bg-muted/50 rounded p-2 overflow-x-auto text-foreground whitespace-pre-wrap break-all">
                {decodeURIComponent(googleUrl.split('?q=')[1] ?? '')}
              </pre>
            </div>
          )}

          {/* Open in Google */}
          <a
            href={hasBoards ? googleUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!hasBoards}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-opacity ${
              hasBoards
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90'
                : 'bg-muted text-[var(--muted-foreground)] opacity-50 pointer-events-none'
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            Open in Google
          </a>

          {/* Next steps */}
          <div className="rounded-lg bg-background border border-[var(--border)]/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5">Next step</p>
            <p className="text-xs">
              Click a result in Google, copy the URL from the address bar, then paste it into{' '}
              <strong className="text-foreground">+ Add Job</strong>. RolePatch scrapes the full
              description and tailors your resume.
            </p>
          </div>

          <p className="text-xs italic pt-1 border-t border-[var(--border)]/40">
            Startup roles rarely get posted publicly — go where they are.
          </p>
        </div>
      )}
    </div>
  );
}
