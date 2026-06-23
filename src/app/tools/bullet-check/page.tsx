'use client';

import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const WEAK_VERBS = new Set([
  'did',
  'made',
  'worked',
  'helped',
  'assisted',
  'responsible',
  'involved',
  'participated',
  'tasked',
  'duties',
  'handled',
  'managed', // ambiguous, but flag for review
  'was',
  'were',
  'had',
]);

const STRONG_VERBS = [
  'shipped',
  'led',
  'built',
  'architected',
  'designed',
  'scaled',
  'reduced',
  'increased',
  'automated',
  'drove',
  'delivered',
  'launched',
  'spearheaded',
  'negotiated',
  'owned',
  'migrated',
  'decomposed',
  'rewrote',
  'instrumented',
  'open-sourced',
];

interface Check {
  ok: boolean;
  label: string;
  detail: string;
}

interface BulletReport {
  raw: string;
  checks: Check[];
  score: number;
}

const QUANTIFIER_RE =
  /(\d+(\.\d+)?\s*%|\$\s*\d+|[0-9]+(?:[,.][0-9]+)*\+?|\b(?:million|thousand|k|m|b)\b)/i;
const FIRST_PERSON_RE = /\b(i|me|my|mine)\b/i;
const VERB_TENSE_HINT_RE = /\b(ing)\b/i; // "managing" instead of "managed"

function analyzeBullet(raw: string): BulletReport {
  const text = raw.trim();
  const _lower = text.toLowerCase();
  const firstWord = (text.split(/\s+/)[0] ?? '').replace(/[^a-zA-Z-]/g, '').toLowerCase();

  const checks: Check[] = [];

  const startsWithStrong = STRONG_VERBS.includes(firstWord);
  const startsWithWeak = WEAK_VERBS.has(firstWord);
  checks.push({
    ok: startsWithStrong || !startsWithWeak,
    label: 'Starts with a strong action verb',
    detail: startsWithStrong
      ? `“${firstWord}” is a great opener.`
      : startsWithWeak
        ? `“${firstWord}” is vague — try a verb like ${STRONG_VERBS.slice(0, 4).join(', ')}.`
        : `“${firstWord}” is fine but consider stronger options.`,
  });

  checks.push({
    ok: QUANTIFIER_RE.test(text),
    label: 'Contains a quantified outcome',
    detail: QUANTIFIER_RE.test(text)
      ? 'A measurable number anchors the impact.'
      : 'No numbers / percentages / dollar figures — add a metric if possible.',
  });

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lenOk = wordCount >= 6 && wordCount <= 24;
  checks.push({
    ok: lenOk,
    label: 'Length within sweet spot (6–24 words)',
    detail: `${wordCount} word${wordCount === 1 ? '' : 's'} — ${
      wordCount < 6 ? 'too short, add context' : wordCount > 24 ? 'too long, trim filler' : 'good'
    }.`,
  });

  const noFirstPerson = !FIRST_PERSON_RE.test(text);
  checks.push({
    ok: noFirstPerson,
    label: 'No first-person pronouns',
    detail: noFirstPerson
      ? "Clean — resume convention drops 'I' / 'my'."
      : "Drop 'I' / 'my' — resume convention is implied first person.",
  });

  const presentParticiple = /\b\w+ing\b/.test(firstWord) || VERB_TENSE_HINT_RE.test(firstWord);
  checks.push({
    ok: !presentParticiple,
    label: 'Uses past tense (or present for current role)',
    detail: presentParticiple
      ? `“${firstWord}” is -ing form — past tense reads stronger.`
      : 'Past tense reads decisive and complete.',
  });

  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);

  // de-duplicate: if no input, all checks fail and score is 0 by design
  if (!text) {
    return { raw, score: 0, checks: [] };
  }

  return { raw, score, checks };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

const PLACEHOLDER = `Built dashboard for support team
Managed deployment pipeline
Reduced API p99 latency from 410ms to 95ms (-77%) by adding read replicas
I was responsible for handling team standups`;

export default function BulletCheckPage() {
  const [text, setText] = useState(PLACEHOLDER);

  const bullets = useMemo(() => {
    return text
      .split(/\n+/)
      .map((line) => line.replace(/^[-•*\s]+/, '').trim())
      .filter((line) => line.length > 0)
      .map(analyzeBullet);
  }, [text]);

  const avg =
    bullets.length === 0
      ? 0
      : Math.round(bullets.reduce((s, b) => s + b.score, 0) / bullets.length);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <Link
        href="/tools"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> All tools
      </Link>

      <header className="mt-3 mb-6">
        <h1 className="font-serif text-3xl font-bold text-foreground">Bullet Strength Checker</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Paste your resume bullets one per line. Each line gets graded on verb strength, quantified
          outcome, length, tense, and first-person leakage. Everything runs in your browser.
        </p>
      </header>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
        placeholder="Paste bullets, one per line…"
      />

      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-[var(--muted-foreground)]">
          {bullets.length} bullet{bullets.length === 1 ? '' : 's'} analyzed
        </span>
        <span className={`text-2xl font-bold tabular-nums ${scoreColor(avg)}`}>{avg}/100</span>
      </div>

      <ul className="mt-6 space-y-4">
        {bullets.map((b, idx) => (
          <li
            key={`${idx}-${b.raw}`}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{b.raw}</p>
              <span className={`text-lg font-bold tabular-nums ${scoreColor(b.score)}`}>
                {b.score}
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {b.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-xs">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  )}
                  <span className={c.ok ? 'text-[var(--muted-foreground)]' : 'text-foreground'}>
                    <span className="font-medium">{c.label}.</span> {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
