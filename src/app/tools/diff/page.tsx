'use client';

import Link from 'next/link';
import { useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

const darkTheme = {
  variables: {
    dark: {
      diffViewerBackground: 'var(--background)',
      diffViewerColor: '#e5e5e5',
      addedBackground: '#0d2818',
      addedColor: 'var(--accent)',
      removedBackground: '#2d1215',
      removedColor: '#f87171',
      wordAddedBackground: '#166534',
      wordRemovedBackground: '#991b1b',
      addedGutterBackground: '#0d2818',
      removedGutterBackground: '#2d1215',
      gutterBackground: '#111111',
      gutterBackgroundDark: '#0d0d0d',
      highlightBackground: '#1a1a1a',
      highlightGutterBackground: '#1a1a1a',
      codeFoldGutterBackground: '#111111',
      codeFoldBackground: '#111111',
      emptyLineBackground: 'var(--background)',
      gutterColor: '#525252',
      addedGutterColor: 'var(--accent)',
      removedGutterColor: '#f87171',
      codeFoldContentColor: '#737373',
      diffViewerTitleBackground: '#111111',
      diffViewerTitleColor: '#a3a3a3',
      diffViewerTitleBorderColor: '#262626',
    },
  },
};

export default function DiffToolPage() {
  const [versionA, setVersionA] = useState('');
  const [versionB, setVersionB] = useState('');
  const [compared, setCompared] = useState(false);
  const [splitView, setSplitView] = useState(true);

  const canCompare = versionA.trim().length > 0 && versionB.trim().length > 0;

  const aLines = versionA.split('\n');
  const bLines = versionB.split('\n');
  const additions = compared ? bLines.filter((l, i) => l !== aLines[i]).length : 0;
  const removals = compared ? aLines.filter((l, i) => l !== bLines[i]).length : 0;

  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12 space-y-4">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Free Resume Diff Tool
        </h1>
        <p className="text-[var(--muted-foreground)] text-lg max-w-2xl mx-auto leading-relaxed">
          Compare two versions of your resume side by side. See exactly what changed, word by word.
          Free, no sign-up required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
            Version A
          </label>
          <textarea
            value={versionA}
            onChange={(e) => {
              setVersionA(e.target.value);
              setCompared(false);
            }}
            placeholder="Paste your original resume text here..."
            className="input-base min-h-[240px] resize-y font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
            Version B
          </label>
          <textarea
            value={versionB}
            onChange={(e) => {
              setVersionB(e.target.value);
              setCompared(false);
            }}
            placeholder="Paste your updated resume text here..."
            className="input-base min-h-[240px] resize-y font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex justify-center mb-10">
        <button
          onClick={() => setCompared(true)}
          disabled={!canCompare}
          className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-xl text-lg transition-colors"
        >
          Compare
        </button>
      </div>

      {compared && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-[var(--accent)] font-bold">+{additions} additions</span>
              <span className="text-red-400 font-bold">-{removals} removals</span>
            </div>
            <button
              onClick={() => setSplitView(!splitView)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-foreground hover:border-[var(--muted-foreground)] transition-colors"
            >
              {splitView ? 'Inline view' : 'Split view'}
            </button>
          </div>
          <div className="overflow-auto">
            <ReactDiffViewer
              oldValue={versionA}
              newValue={versionB}
              splitView={splitView}
              useDarkTheme={true}
              compareMethod={DiffMethod.WORDS}
              styles={darkTheme}
              leftTitle="Version A"
              rightTitle="Version B"
            />
          </div>
        </div>
      )}

      <div className="mt-16 text-center">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 max-w-xl mx-auto">
          <p className="text-[var(--muted-foreground)] mb-4">
            Want AI to tailor your resume automatically?
          </p>
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
