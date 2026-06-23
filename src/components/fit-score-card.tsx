'use client';

import { useState } from 'react';

import type { FitScore } from '@/lib/types';

function scoreColor(score: number) {
  if (score >= 70)
    return {
      bar: 'bg-[var(--accent)]',
      text: 'text-[var(--accent)]',
      bg: 'bg-[var(--accent)]/10',
      border: 'border-[var(--accent)]/20',
    };
  if (score >= 40)
    return {
      bar: 'bg-amber-400',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    };
  return {
    bar: 'bg-red-400',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  };
}

function gradeLabel(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

interface FitScoreCardProps {
  fitScore: FitScore;
}

export function FitScoreCard({ fitScore }: FitScoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreColor(fitScore.overall_score);
  const grade = gradeLabel(fitScore.overall_score);

  return (
    <div className={`rounded-xl border ${color.border} ${color.bg} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:brightness-110 transition-all"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${color.bg} border ${color.border} flex items-center justify-center`}
          >
            <span className={`text-lg font-black ${color.text}`}>{grade}</span>
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Job Fit Score
            </p>
            <p className={`text-xl font-black ${color.text} leading-tight`}>
              {fitScore.overall_score}
              <span className="text-sm font-bold opacity-50">/100</span>
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)]/30">
          {/* Dimension bars */}
          <div className="pt-3 space-y-2.5">
            {fitScore.dimensions.map((dim) => {
              const dimColor = scoreColor(dim.score);
              return (
                <div key={dim.name} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[var(--muted-foreground)]">
                      {dim.name}
                      <span className="opacity-40 ml-1">({dim.weight}%)</span>
                    </span>
                    <span className={`text-xs font-black ${dimColor.text}`}>{dim.score}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--border)]/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${dimColor.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] opacity-60 mt-0.5 leading-snug">
                    {dim.detail}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Strengths & Gaps */}
          <div className="grid grid-cols-2 gap-3">
            {fitScore.strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest mb-1.5">
                  Strengths
                </p>
                <ul className="space-y-1">
                  {fitScore.strengths.map((s, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-[var(--muted-foreground)] leading-snug flex gap-1.5"
                    >
                      <span className="text-[var(--accent)] shrink-0">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {fitScore.gaps.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5">
                  Gaps
                </p>
                <ul className="space-y-1">
                  {fitScore.gaps.map((g, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-[var(--muted-foreground)] leading-snug flex gap-1.5"
                    >
                      <span className="text-amber-400 shrink-0">-</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendation */}
          {fitScore.recommendation && (
            <div className="pt-2 border-t border-[var(--border)]/20">
              <p className="text-[10px] font-black text-[var(--primary)] uppercase tracking-widest mb-1">
                Recommendation
              </p>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                {fitScore.recommendation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact badge for dashboard */
export function FitScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score);
  const grade = gradeLabel(score);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-black ${color.text} ${color.bg} border ${color.border} px-2.5 py-0.5 rounded-full`}
    >
      {grade} <span className="opacity-60 font-bold">{score}</span>
    </span>
  );
}
