'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { createStashEntry, deleteStashEntry, updateStashEntry } from '@/lib/actions/stash-actions';
import {
  localCreateStashEntry,
  localDeleteStashEntry,
  localListStashEntries,
  localUpdateStashEntry,
} from '@/lib/local-storage';
import type { StashEntry } from '@/lib/types';

const CATEGORIES = ['experience', 'skills', 'projects', 'education', 'certifications', 'other'];

const CATEGORY_ICONS: Record<string, string> = {
  experience: '💼',
  skills: '⚡',
  projects: '🔧',
  education: '🎓',
  certifications: '📜',
  other: '📌',
};

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '- ')
    .replace(/\n{2,}/g, '\n');
}

interface StashListProps {
  serverEntries: StashEntry[];
}

export function StashList({ serverEntries }: StashListProps) {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [entries, setEntries] = useState(serverEntries);

  useEffect(() => {
    if (isGuest) {
      setEntries(localListStashEntries());
    }
  }, [isGuest]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StashEntry | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    if (loading) return;
    setModalOpen(false);
    setEditing(null);
    setCategory(CATEGORIES[0]);
    setLabel('');
    setContent('');
  }, [loading]);

  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalOpen, close]);

  function openNew() {
    setEditing(null);
    setCategory(CATEGORIES[0]);
    setLabel('');
    setContent('');
    setModalOpen(true);
  }

  function openEdit(entry: StashEntry) {
    setEditing(entry);
    setCategory(entry.category);
    setLabel(entry.label);
    setContent(entry.content);
    setModalOpen(true);
  }

  async function handleSave() {
    const trimmedLabel = label.trim();
    const trimmedContent = content.trim();
    if (!trimmedLabel || !trimmedContent) return;

    setLoading(true);
    try {
      if (isGuest) {
        if (editing) {
          localUpdateStashEntry(editing.id, category, trimmedLabel, trimmedContent);
        } else {
          localCreateStashEntry(category, trimmedLabel, trimmedContent);
        }
        close();
        setEntries(localListStashEntries());
      } else {
        if (editing) {
          await updateStashEntry(editing.id, category, trimmedLabel, trimmedContent);
        } else {
          await createStashEntry(category, trimmedLabel, trimmedContent);
        }
        close();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setLoading(true);
    try {
      if (isGuest) {
        localDeleteStashEntry(editing.id);
        close();
        setEntries(localListStashEntries());
      } else {
        await deleteStashEntry(editing.id);
        close();
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const grouped = CATEGORIES.reduce<Record<string, StashEntry[]>>((acc, cat) => {
    const items = entries.filter((e) => e.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={openNew}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] hover:border-[var(--muted-foreground)] transition-colors"
        >
          + Add Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] rounded-xl py-16 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[var(--card)] flex items-center justify-center mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-[var(--muted-foreground)]"
            >
              <path
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">No stash entries yet</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Save resume snippets to reuse across applications
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">{CATEGORY_ICONS[cat] ?? '📌'}</span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)] capitalize">
                  {cat}
                </h2>
                <span className="text-xs text-[var(--muted-foreground)] bg-[var(--card)] px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => openEdit(entry)}
                    className="group border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/50 hover:bg-[var(--card)]/50 transition-all cursor-pointer"
                  >
                    <h3 className="font-medium text-sm text-foreground group-hover:text-[var(--accent)] transition-colors">
                      {entry.label}
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)] line-clamp-3 whitespace-pre-line mt-2 leading-relaxed">
                      {stripMarkdown(entry.content)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 modal-backdrop" onClick={close} />
          <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 modal-content">
            <h2 className="text-lg font-semibold mb-5">
              {editing ? 'Edit Entry' : 'New Stash Entry'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-base"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., ML Engineer at Startup X"
                  className="input-base"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Content
                </label>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Markdown content..."
                  className="input-base resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {editing && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={loading}
                      className="px-3 py-2 text-xs font-medium rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      {loading ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading || !label.trim() || !content.trim()}
                    className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
