'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { updateResume } from '@/lib/actions/resume-actions';
import { compileTypst } from '@/lib/typst-compiler';
import { convertLatexToTypst } from '@/lib/actions/convert-action';

interface Props {
  resumeId: string;
  initialSource: string;
}

export function LatexEditor({ resumeId, initialSource }: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);

  const save = useCallback(async () => {
    if (!viewRef.current) return;
    const source = viewRef.current.state.doc.toString();
    setSaving(true);
    setCompileError(null);
    await updateResume(resumeId, source);
    try {
      const url = await compileTypst(source);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    } catch (err) {
      console.error('Compilation failed:', err);
      setCompileError(err instanceof Error ? err.message : 'Compilation failed');
    }
    setSaving(false);
  }, [resumeId]);

  const saveRef = useRef(save);
  saveRef.current = save;

  const convertFromLatex = useCallback(async () => {
    if (!viewRef.current) return;
    const source = viewRef.current.state.doc.toString();
    if (!source.includes('\\begin{') && !source.includes('\\documentclass')) {
      setCompileError('Content does not appear to be LaTeX');
      return;
    }
    setConverting(true);
    setCompileError(null);
    try {
      const typstSource = await convertLatexToTypst(source);
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: typstSource },
      });
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : 'Conversion failed');
    }
    setConverting(false);
  }, []);

  useEffect(() => {
    if (!editorContainerRef.current || viewRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          saveRef.current();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: initialSource,
      extensions: [
        basicSetup,
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
  }, [initialSource]);

  return (
    <>
      <div className="w-1/2 flex flex-col overflow-hidden border-r">
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-gray-50">
          <span className="text-xs text-gray-500">{saving ? 'Saving...' : converting ? 'Converting...' : 'Typst'}</span>
          <div className="flex gap-1.5">
            <button
              onClick={convertFromLatex}
              disabled={saving || converting}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              Convert from LaTeX
            </button>
            <button
              onClick={save}
              disabled={saving || converting}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Compile
            </button>
          </div>
        </div>
        <div ref={editorContainerRef} className="flex-1 overflow-hidden" />
      </div>
      <div className="w-1/2 flex items-center justify-center bg-gray-100 relative">
        {pdfUrl ? (
          <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
        ) : compileError ? (
          <div className="p-4 max-w-full overflow-auto">
            <p className="text-red-500 font-medium mb-2">Compilation Error</p>
            <pre className="text-xs text-red-400 whitespace-pre-wrap">{compileError}</pre>
          </div>
        ) : (
          <p className="text-gray-400">Press Cmd+S or click Compile</p>
        )}
      </div>
    </>
  );
}
