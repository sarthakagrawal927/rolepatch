'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

const darkTheme = {
  variables: {
    dark: {
      diffViewerBackground: '#0a0a0a',
      diffViewerColor: '#e5e5e5',
      addedBackground: '#0d2818',
      addedColor: '#4ade80',
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
      emptyLineBackground: '#0a0a0a',
      gutterColor: '#525252',
      addedGutterColor: '#4ade80',
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

  // Count changes
  const aLines = versionA.split('\n');
  const bLines = versionB.split('\n');
  const additions = compared ? bLines.filter((l, i) => l !== aLines[i]).length : 0;
  const removals = compared ? aLines.filter((l, i) => l !== bLines[i]).length : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">RP</span>
            <span className="font-bold text-lg tracking-tight text-white">RolePatch</span>
          </Link>
          <Link
            href="/dashboard"
            className="bg-white text-gray-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Free Resume Diff Tool</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Compare two versions of your resume side by side. See exactly what changed, word by word. Free, no sign-up required.
          </p>
        </div>

        {/* Textareas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Version A</label>
            <textarea
              value={versionA}
              onChange={(e) => { setVersionA(e.target.value); setCompared(false); }}
              placeholder="Paste your original resume text here..."
              className="input-base min-h-[240px] resize-y font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Version B</label>
            <textarea
              value={versionB}
              onChange={(e) => { setVersionB(e.target.value); setCompared(false); }}
              placeholder="Paste your updated resume text here..."
              className="input-base min-h-[240px] resize-y font-mono text-sm"
            />
          </div>
        </div>

        {/* Compare button */}
        <div className="flex justify-center mb-10">
          <button
            onClick={() => setCompared(true)}
            disabled={!canCompare}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl text-lg transition-colors"
          >
            Compare
          </button>
        </div>

        {/* Diff output */}
        {compared && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-950/60">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-400 font-medium">+{additions} additions</span>
                <span className="text-red-400 font-medium">-{removals} removals</span>
              </div>
              <button
                onClick={() => setSplitView(!splitView)}
                className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                {splitView ? 'Inline view' : 'Split view'}
              </button>
            </div>

            {/* Diff viewer */}
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

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="rounded-xl border border-gray-800 p-8 max-w-xl mx-auto">
            <p className="text-gray-400 mb-4">Want AI to tailor your resume automatically?</p>
            <Link
              href="/dashboard"
              className="inline-block bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Try RolePatch free &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
