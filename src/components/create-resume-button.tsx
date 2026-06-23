'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { createResume } from '@/lib/actions/resume-actions';
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

  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
    setName('');
  }, [loading]);

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
  }, [open, close]);

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
        className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-foreground hover:bg-[var(--muted)] hover:border-[var(--muted-foreground)] transition-colors"
      >
        + New Resume
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 modal-backdrop" onClick={close} />
          <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 modal-content">
            <h2 className="text-lg font-semibold mb-5">New Resume</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                  Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Software Engineer Resume"
                  className="input-base"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
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
