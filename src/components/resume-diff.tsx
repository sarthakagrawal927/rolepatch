'use client';

import { useEffect, useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

import type { TailorChange } from '@/lib/types';

interface Props {
  original: string;
  modified: string;
  onModifiedChange: (value: string) => void;
  changes?: TailorChange[];
}

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

export function ResumeDiff({ original, modified, onModifiedChange, changes = [] }: Props) {
  const [splitView, setSplitView] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(modified);
  const [rationaleOpen, setRationaleOpen] = useState(true);

  // On small screens the side-by-side diff overflows — default to inline.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mql.matches) {
        setSplitView(false);
        setRationaleOpen(false);
      }
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  function handleSaveEdit() {
    onModifiedChange(editContent);
    setEditing(false);
  }

  function handleCancelEdit() {
    setEditContent(modified);
    setEditing(false);
  }

  // Count changes
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const additions = modifiedLines.filter((l, i) => l !== originalLines[i]).length;
  const removals = originalLines.filter((l, i) => l !== modifiedLines[i]).length;

  const hasRationale = changes.length > 0;

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Main diff column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]/50">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[var(--accent)]">+{additions} additions</span>
            <span className="text-red-400">-{removals} removals</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasRationale && (
              <button
                onClick={() => setRationaleOpen((v) => !v)}
                className="text-xs px-3 min-h-[36px] md:min-h-0 md:py-1 rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:text-foreground hover:border-[var(--muted-foreground)] transition-colors"
                aria-expanded={rationaleOpen}
              >
                {rationaleOpen ? 'Hide rationale' : `Why these changes? (${changes.length})`}
              </button>
            )}
            <button
              onClick={() => setSplitView(!splitView)}
              className="text-xs px-3 min-h-[36px] md:min-h-0 md:py-1 rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:text-foreground hover:border-[var(--muted-foreground)] transition-colors"
            >
              {splitView ? 'Inline' : 'Split'}
            </button>
            {!editing ? (
              <button
                onClick={() => {
                  setEditContent(modified);
                  setEditing(true);
                }}
                className="text-xs px-3 min-h-[36px] md:min-h-0 md:py-1 rounded border border-[var(--border)] text-[var(--muted-foreground)] hover:text-foreground hover:border-[var(--muted-foreground)] transition-colors"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="text-xs px-3 min-h-[36px] md:min-h-0 md:py-1 rounded text-[var(--muted-foreground)] hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="text-xs px-3 min-h-[36px] md:min-h-0 md:py-1 rounded bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors"
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full p-4 bg-[var(--background)] text-foreground text-sm font-mono resize-none focus:outline-none"
            />
          ) : (
            <ReactDiffViewer
              oldValue={original}
              newValue={modified}
              splitView={splitView}
              useDarkTheme={true}
              compareMethod={DiffMethod.WORDS}
              styles={darkTheme}
              leftTitle="Original"
              rightTitle="Tailored"
            />
          )}
        </div>
      </div>

      {/* Rationale sidebar — stacks below the diff on mobile */}
      {hasRationale && rationaleOpen && (
        <aside className="w-full md:w-80 shrink-0 max-h-64 md:max-h-none border-t md:border-t-0 md:border-l border-[var(--border)] bg-[var(--card)]/30 flex flex-col">
          <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Why these changes?
            </h3>
            <span className="text-xs text-[var(--muted-foreground)]">{changes.length}</span>
          </div>
          <ul className="flex-1 overflow-y-auto p-3 space-y-3">
            {changes.map((c, i) => (
              <li
                key={i}
                className="rounded-md border border-[var(--border)]/60 bg-[var(--background)]/60 p-3 text-xs space-y-2"
              >
                <p className="text-foreground font-mono leading-snug border-l-2 border-[var(--accent)] pl-2">
                  {c.snippet}
                </p>
                <p className="text-[var(--muted-foreground)] leading-relaxed">{c.reason}</p>
                {c.jd_match && (
                  <p className="inline-block px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-medium">
                    JD: {c.jd_match}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
