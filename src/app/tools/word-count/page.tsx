'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

interface Stats {
  characters: number;
  charactersNoSpace: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  bullets: number;
  readingSeconds: number;
}

function analyze(text: string): Stats {
  const characters = text.length;
  const charactersNoSpace = text.replace(/\s+/g, '').length;
  const words = (text.match(/\S+/g) ?? []).length;
  const lines = text.split(/\n/).length;
  const sentences = (text.match(/[^.!?\n]+[.!?]+/g) ?? []).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const bullets = text.split(/\n/).filter((l) => /^\s*[-*•]/.test(l)).length;
  // 230 words/min is the common skim rate for resumes / bullet copy.
  const readingSeconds = Math.round((words / 230) * 60);
  return {
    characters,
    charactersNoSpace,
    words,
    lines,
    sentences,
    paragraphs,
    bullets,
    readingSeconds,
  };
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (rem === 0) return `${m}m`;
  return `${m}m ${rem}s`;
}

export default function WordCountPage() {
  const [text, setText] = useState('');
  const stats = useMemo(() => (text.length > 0 ? analyze(text) : null), [text]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-xs text-stone-500 hover:underline">
        ← RolePatch
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Word count</h1>
      <p className="mt-3 text-sm text-stone-600">
        Paste anything — resume, cover letter, bio — to get word / line / sentence / paragraph
        counts and an estimated recruiter-skim time. Local only; no network call.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text here…"
        className="mt-6 h-64 w-full resize-y rounded-md border border-stone-300 p-3 font-mono text-xs"
      />

      {stats && (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Words" value={stats.words.toLocaleString()} />
          <Stat label="Characters" value={stats.characters.toLocaleString()} />
          <Stat label="No-space chars" value={stats.charactersNoSpace.toLocaleString()} />
          <Stat label="Lines" value={stats.lines.toLocaleString()} />
          <Stat label="Sentences" value={stats.sentences.toLocaleString()} />
          <Stat label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
          <Stat label="Bullet rows" value={stats.bullets.toLocaleString()} />
          <Stat label="Skim time" value={formatSeconds(stats.readingSeconds)} hint="@ 230 wpm" />
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      {hint && <p className="text-[10px] text-stone-400">{hint}</p>}
    </div>
  );
}
