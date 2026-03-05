'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createResume } from '@/lib/actions/resume-actions';
import { useAuth } from '@/components/auth-provider';
import { localCreateResume } from '@/lib/local-storage';

const DEFAULT_MARKDOWN_TEMPLATE = `# Your Name

your.email@example.com | (555) 123-4567 | City, ST
[LinkedIn](https://linkedin.com/in/yourprofile) | [GitHub](https://github.com/yourprofile)

---

## Experience

**Job Title** — _Company Name_ | Start – End

- Accomplishment or responsibility
- Another accomplishment with measurable impact

## Education

**Degree, Major** — _University Name_ | Graduation Year

Relevant coursework or honors

## Skills

**Languages:** JavaScript, TypeScript, Python
**Frameworks:** React, Next.js, Node.js
**Tools:** Git, Docker, AWS
`;

export function CreateResumeButton() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  function close() {
    if (loading) return;
    setOpen(false);
    setName('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      let id: string;
      if (isGuest) {
        id = localCreateResume(trimmed, DEFAULT_MARKDOWN_TEMPLATE);
      } else {
        id = await createResume(trimmed);
      }
      close();
      router.push(`/editor/${id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        New Resume
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">New Resume</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Software Engineer Resume"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
