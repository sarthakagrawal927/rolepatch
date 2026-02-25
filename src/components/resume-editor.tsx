'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { markdown } from '@codemirror/lang-markdown';
import Markdown from 'react-markdown';
import Link from 'next/link';
import { updateResume } from '@/lib/actions/resume-actions';
import '@/styles/resume-print.css';

interface Props {
  resumeId: string;
  initialSource: string;
  resumeName: string;
}

const FONT_OPTIONS = [
  { label: 'Charter', value: "'Charter', 'Georgia', 'Times New Roman', serif" },
  { label: 'Georgia', value: "'Georgia', 'Times New Roman', serif" },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Garamond', value: "'Garamond', 'Georgia', serif" },
  { label: 'Helvetica', value: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif" },
  { label: 'Arial', value: "'Arial', 'Helvetica', sans-serif" },
  { label: 'Calibri', value: "'Calibri', 'Helvetica', sans-serif" },
  { label: 'System Sans', value: "system-ui, -apple-system, sans-serif" },
];

const STORAGE_KEY = 'resume-tailor-config';
// Content area per page: 11in page - 0.5in top padding - 0.5in bottom padding
const PAGE_CONTENT_PX = 10 * 96; // 960px

/** Walk the measurement div and find smart page break offsets (in px).
 *  Avoids orphaning headings at the bottom of a page. */
function calculateBreakPoints(el: HTMLElement): number[] {
  const total = el.scrollHeight;
  if (total <= PAGE_CONTENT_PX) return [0];

  // Collect positions of h2/h3 headings — never break right before these
  const headings = el.querySelectorAll('h2, h3');
  const avoidBreakAfter: { top: number; safeTop: number }[] = [];
  for (const h of headings) {
    const hEl = h as HTMLElement;
    const top = hEl.offsetTop;
    // Keep heading + at least its next sibling together
    const next = hEl.nextElementSibling as HTMLElement | null;
    const bottom = next
      ? next.offsetTop + Math.min(next.offsetHeight, 60)
      : top + hEl.offsetHeight;
    avoidBreakAfter.push({ top, safeTop: bottom });
  }

  const breaks: number[] = [0];
  let idealBreak = PAGE_CONTENT_PX;

  while (idealBreak < total) {
    let adjusted = idealBreak;
    // If the break falls inside a heading zone, move it before the heading
    for (const zone of avoidBreakAfter) {
      if (idealBreak > zone.top && idealBreak < zone.safeTop) {
        adjusted = zone.top;
        break;
      }
    }
    breaks.push(adjusted);
    idealBreak = adjusted + PAGE_CONTENT_PX;
  }

  return breaks;
}

function loadConfig() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveConfig(cfg: { fontSize: number; lineHeight: number; fontFamily: string; margin: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

export function ResumeEditor({ resumeId, initialSource, resumeName }: Props) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState(initialSource);
  const [showConfig, setShowConfig] = useState(false);
  const [breakPoints, setBreakPoints] = useState<number[]>([0]);
  const configRef = useRef<HTMLDivElement>(null);

  const [fontSize, setFontSize] = useState(10.5);
  const [lineHeight, setLineHeight] = useState(1.35);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [margin, setMargin] = useState(0.5);
  const configLoaded = useRef(false);

  // Load config from localStorage after hydration
  useEffect(() => {
    const stored = loadConfig();
    if (stored) {
      if (stored.fontSize != null) setFontSize(stored.fontSize);
      if (stored.lineHeight != null) setLineHeight(stored.lineHeight);
      if (stored.fontFamily != null) setFontFamily(stored.fontFamily);
      if (stored.margin != null) setMargin(stored.margin);
    }
    configLoaded.current = true;
  }, []);

  // Persist config changes (skip initial load)
  useEffect(() => {
    if (!configLoaded.current) return;
    saveConfig({ fontSize, lineHeight, fontFamily, margin });
  }, [fontSize, lineHeight, fontFamily, margin]);

  // Track page breaks via ResizeObserver on the measurement div
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      setBreakPoints(calculateBreakPoints(el));
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    // Small delay to let fonts/layout settle
    requestAnimationFrame(update);
    return () => observer.disconnect();
  }, []);

  // Close popover on outside click
  useEffect(() => {
    if (!showConfig) return;
    const handler = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setShowConfig(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showConfig]);

  const save = useCallback(async () => {
    if (!viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    setSaving(true);
    await updateResume(resumeId, text);
    setSource(text);
    setSaving(false);
  }, [resumeId]);

  const saveRef = useRef(save);
  saveRef.current = save;

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

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setSource(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: initialSource,
      extensions: [
        basicSetup,
        oneDark,
        markdown(),
        saveKeymap,
        updateListener,
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

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const cssVars = {
    '--resume-font-size': `${fontSize}pt`,
    '--resume-line-height': String(lineHeight),
    '--resume-font-family': fontFamily,
    '--resume-margin': `${margin}in`,
  } as React.CSSProperties;

  return (
    <>
      {/* Editor pane */}
      <div className="w-1/2 flex flex-col overflow-hidden border-r border-gray-200 print-hide">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">
          <Link
            href="/"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Back to dashboard"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
          </Link>
          <span className="text-sm font-medium text-gray-700 truncate">{resumeName}</span>

          <span className={`text-xs tabular-nums ${breakPoints.length > 1 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
            {breakPoints.length === 1 ? '1 page' : `${breakPoints.length} pages`}
          </span>

          <span className="text-xs text-gray-400">
            {saving ? 'Saving...' : ''}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative" ref={configRef}>
              <button
                onClick={() => setShowConfig((v) => !v)}
                className={`p-1.5 rounded transition-colors ${showConfig ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title="Format settings"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
              </button>

              {showConfig && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Font Family</label>
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.label} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Size (pt)</label>
                        <input
                          type="number"
                          min={8} max={14} step={0.5}
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Leading</label>
                        <input
                          type="number"
                          min={1} max={2} step={0.05}
                          value={lineHeight}
                          onChange={(e) => setLineHeight(Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Margin (in)</label>
                        <input
                          type="number"
                          min={0.25} max={1} step={0.05}
                          value={margin}
                          onChange={(e) => setMargin(Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Export PDF
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <div ref={editorContainerRef} className="flex-1 overflow-hidden" />
      </div>

      {/* Preview pane — paginated */}
      <div className="w-1/2 overflow-y-auto bg-gray-100 py-8 px-6 print-hide" id="resume-print-target">
        {/* Hidden measurement div — same styling, unconstrained height */}
        <div ref={measureRef} className="resume-measure" style={cssVars} aria-hidden="true">
          <Markdown>{source}</Markdown>
        </div>

        {/* Visible page cards */}
        {breakPoints.map((offsetPx, i) => (
          <div key={i} className="resume-page" style={cssVars}>
            <div className="resume-page-clip">
              <div style={offsetPx > 0 ? { marginTop: `-${offsetPx}px` } : undefined}>
                <Markdown>{source}</Markdown>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden print target — continuous flow for browser pagination */}
      <div className="hidden print-show" id="resume-print-only">
        <div className="resume-preview" style={cssVars}>
          <Markdown>{source}</Markdown>
        </div>
      </div>
    </>
  );
}
