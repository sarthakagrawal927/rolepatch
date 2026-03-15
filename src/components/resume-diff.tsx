'use client';

import { useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

interface Props {
  original: string;
  modified: string;
  onModifiedChange: (value: string) => void;
}

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

export function ResumeDiff({ original, modified, onModifiedChange }: Props) {
  const [splitView, setSplitView] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(modified);

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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400">+{additions} additions</span>
          <span className="text-red-400">-{removals} removals</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSplitView(!splitView)}
            className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            {splitView ? 'Inline' : 'Split'}
          </button>
          {!editing ? (
            <button
              onClick={() => { setEditContent(modified); setEditing(true); }}
              className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleCancelEdit}
                className="text-xs px-2 py-1 rounded text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-500 transition-colors"
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
            className="w-full h-full p-4 bg-[#0a0a0a] text-gray-200 text-sm font-mono resize-none focus:outline-none"
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
  );
}
