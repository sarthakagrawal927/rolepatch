'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { oneDark } from '@codemirror/theme-one-dark';
import { updateResume } from '@/lib/actions/resume-actions';

interface Props {
  resumeId: string;
  initialSource: string;
}

export function LatexEditor({ resumeId, initialSource }: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!viewRef.current) return;
    const source = viewRef.current.state.doc.toString();
    setSaving(true);
    await updateResume(resumeId, source);
    // TODO: Task 6 will add WASM compilation here
    setSaving(false);
  }, [resumeId]);

  useEffect(() => {
    if (!editorContainerRef.current || viewRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          save();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: initialSource,
      extensions: [
        basicSetup,
        StreamLanguage.define(stex),
        oneDark,
        saveKeymap,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [initialSource, save]);

  return (
    <>
      <div ref={editorContainerRef} className="w-1/2 overflow-hidden border-r" />
      <div className="w-1/2 flex items-center justify-center bg-gray-100 relative">
        {saving && (
          <span className="absolute top-3 right-3 text-xs text-gray-500">Saving...</span>
        )}
        {pdfUrl ? (
          <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
        ) : (
          <p className="text-gray-400">Press Cmd+S to save and compile</p>
        )}
      </div>
    </>
  );
}
