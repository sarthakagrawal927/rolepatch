'use client';

import Link from 'next/link';
import { useState } from 'react';

import { type ATSResult, calculateATSScore } from '@/lib/ats-score';

function scoreColor(score: number) {
  if (score > 70) return { stroke: 'var(--accent)', text: 'text-[var(--accent)]' };
  if (score >= 40) return { stroke: '#f59e0b', text: 'text-amber-400' };
  return { stroke: '#ef4444', text: 'text-red-400' };
}

function ScoreCircle({ score }: { score: number }) {
  const color = scoreColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-[140px] h-[140px]">
      <svg width="140" height="140" className="-rotate-90 absolute">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className={`text-4xl font-black ${color.text}`}>{score}</span>
        <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
          ATS Score
        </span>
      </div>
    </div>
  );
}

export default function KeywordsToolPage() {
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [result, setResult] = useState<ATSResult | null>(null);

  const canAnalyze = resumeText.trim().length > 0 && jdText.trim().length > 0;

  function handleAnalyze() {
    const r = calculateATSScore(resumeText, jdText);
    setResult(r);
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12 space-y-4">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Free ATS Keyword Checker
        </h1>
        <p className="text-[var(--muted-foreground)] text-lg max-w-2xl mx-auto leading-relaxed">
          Check how well your resume matches a job description. See matched and missing keywords
          instantly. Free, no sign-up required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
            Your Resume
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => {
              setResumeText(e.target.value);
              setResult(null);
            }}
            placeholder="Paste your resume text here..."
            className="input-base min-h-[240px] resize-y font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
            Job Description
          </label>
          <textarea
            value={jdText}
            onChange={(e) => {
              setJdText(e.target.value);
              setResult(null);
            }}
            placeholder="Paste the job description here..."
            className="input-base min-h-[240px] resize-y font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex justify-center mb-10">
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl text-lg transition-colors"
        >
          Analyze
        </button>
      </div>

      {result && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col items-center mb-8">
            <ScoreCircle score={result.score} />
            <p className="text-sm text-[var(--muted-foreground)] mt-4">
              {result.matchedKeywords.length} of {result.totalKeywords} keywords matched
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {result.matchedKeywords.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest mb-3">
                  Matched keywords ({result.matchedKeywords.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.matchedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.missingKeywords.length > 0 && (
              <div>
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">
                  Missing keywords ({result.missingKeywords.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.missingKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/15 text-red-400 border border-red-500/20"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-16 text-center">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 max-w-xl mx-auto">
          <p className="text-[var(--muted-foreground)] mb-4">Let AI fix the gaps automatically.</p>
          <Link
            href="/dashboard"
            className="inline-block bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Try RolePatch free &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
