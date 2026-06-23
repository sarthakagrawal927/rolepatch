'use client';

import { useState } from 'react';

interface ATSScoreBadgeProps {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  label?: string;
}

function scoreColor(score: number) {
  if (score > 70)
    return {
      stroke: 'var(--accent)',
      text: 'text-[var(--accent)]',
      bg: 'bg-[var(--accent)]/10',
      border: 'border-[var(--accent)]/20',
    };
  if (score >= 40)
    return {
      stroke: '#f59e0b',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    };
  return {
    stroke: '#ef4444',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  };
}

export function ATSScoreBadge({
  score,
  matchedKeywords,
  missingKeywords,
  label,
}: ATSScoreBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(score);

  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${color.bg} border ${color.border} hover:brightness-110 transition-all`}
        title="Click to see keyword details"
      >
        {/* Circular progress */}
        <svg width="36" height="36" className="-rotate-90">
          <circle cx="18" cy="18" r={radius} fill="none" stroke="#374151" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="text-left">
          {label && (
            <p className="text-[10px] text-[var(--muted-foreground)] leading-none">{label}</p>
          )}
          <p className={`text-sm font-bold ${color.text} leading-tight`}>{score}</p>
        </div>
      </button>

      {/* Expanded keyword panel */}
      {expanded && (
        <div className="absolute top-full mt-2 right-0 z-50 w-80 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              ATS Keyword Analysis
            </h4>
            <button
              onClick={() => setExpanded(false)}
              className="text-[var(--muted-foreground)] hover:text-foreground text-xs"
            >
              Close
            </button>
          </div>

          {matchedKeywords.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-medium text-[var(--accent)] mb-1.5">
                Matched ({matchedKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {matchedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 text-[11px] rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {missingKeywords.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-red-400 mb-1.5">
                Missing ({missingKeywords.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {missingKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 text-[11px] rounded-full bg-red-500/15 text-red-400 border border-red-500/20"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact inline badge for dashboard cards */
export function ATSScoreMini({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <span
      className={`text-xs font-bold ${color.text} ${color.bg} border ${color.border} px-2 py-0.5 rounded-full`}
    >
      {score}
    </span>
  );
}
