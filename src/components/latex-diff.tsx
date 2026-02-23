'use client';

import { DiffEditor } from '@monaco-editor/react';

interface Props {
  original: string;
  modified: string;
  onModifiedChange: (value: string) => void;
}

export function LatexDiff({ original, modified, onModifiedChange }: Props) {
  return (
    <DiffEditor
      height="100%"
      language="latex"
      original={original}
      modified={modified}
      onMount={(editor) => {
        const modifiedEditor = editor.getModifiedEditor();
        modifiedEditor.onDidChangeModelContent(() => {
          onModifiedChange(modifiedEditor.getValue());
        });
      }}
      options={{
        renderSideBySide: true,
        readOnly: false,
        originalEditable: false,
      }}
    />
  );
}
