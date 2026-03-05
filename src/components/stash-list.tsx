'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { StashEntry } from '@/lib/types';
import { createStashEntry, updateStashEntry, deleteStashEntry } from '@/lib/actions/stash-actions';
import { useAuth } from '@/components/auth-provider';
import {
  localListStashEntries,
  localCreateStashEntry,
  localUpdateStashEntry,
  localDeleteStashEntry,
} from '@/lib/local-storage';

const CATEGORIES = ['experience', 'skills', 'projects', 'education', 'certifications', 'other'];

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

  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalOpen, loading]);

  function close() {
    if (loading) return;
    setModalOpen(false);
    setEditing(null);
    setCategory(CATEGORIES[0]);
    setLabel('');
    setContent('');
  }

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
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          Add Entry
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No stash entries yet. Add one to get started.</p>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <section key={cat}>
              <h2 className="text-lg font-semibold mb-4 capitalize">{cat}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => openEdit(entry)}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-green-500 dark:hover:border-green-500 transition-colors cursor-pointer"
                  >
                    <h3 className="font-semibold text-sm mb-2">{entry.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 whitespace-pre-line">
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
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Entry' : 'Add Entry'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g., ML Engineer at Startup X"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Markdown content..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading || !label.trim() || !content.trim()}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
