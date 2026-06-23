'use client';

import { Clipboard, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import {
  formatEvidenceBullet,
  rankEvidenceForRole,
  scoreEvidenceQuality,
  splitEvidenceList,
} from '@/lib/achievement-evidence';
import {
  type AchievementEvidenceInput,
  createAchievementEvidence,
  deleteAchievementEvidence,
  updateAchievementEvidence,
} from '@/lib/actions/achievement-evidence-actions';
import {
  localCreateAchievementEvidence,
  localDeleteAchievementEvidence,
  localListAchievementEvidence,
  localUpdateAchievementEvidence,
} from '@/lib/local-storage';
import type { AchievementEvidence, AchievementImpact } from '@/lib/types';

const IMPACT_OPTIONS: AchievementImpact[] = [
  'revenue',
  'cost',
  'growth',
  'quality',
  'speed',
  'leadership',
  'technical',
  'other',
];

const EMPTY_FORM = {
  title: '',
  situation: '',
  action: '',
  result: '',
  metric: '',
  scope: '',
  skills: '',
  role_targets: '',
  impact_type: 'technical' as AchievementImpact,
};

interface Props {
  serverEntries: AchievementEvidence[];
  compact?: boolean;
  roleHint?: string;
}

function toInput(form: typeof EMPTY_FORM): AchievementEvidenceInput {
  return {
    title: form.title,
    situation: form.situation,
    action: form.action,
    result: form.result,
    metric: form.metric,
    scope: form.scope,
    skills: splitEvidenceList(form.skills),
    role_targets: splitEvidenceList(form.role_targets),
    impact_type: form.impact_type,
  };
}

function toForm(entry: AchievementEvidence) {
  return {
    title: entry.title,
    situation: entry.situation,
    action: entry.action,
    result: entry.result,
    metric: entry.metric,
    scope: entry.scope,
    skills: entry.skills.join(', '),
    role_targets: entry.role_targets.join(', '),
    impact_type: entry.impact_type,
  };
}

export function AchievementEvidenceBank({ serverEntries, compact = false, roleHint = '' }: Props) {
  const router = useRouter();
  const { isGuest } = useAuth();
  const [entries, setEntries] = useState(serverEntries);
  const [editing, setEditing] = useState<AchievementEvidence | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isGuest) setEntries(localListAchievementEvidence());
  }, [isGuest]);

  const visibleEntries = useMemo(() => {
    const ranked = roleHint ? rankEvidenceForRole(entries, roleHint) : entries;
    return compact ? ranked.slice(0, 3) : ranked;
  }, [compact, entries, roleHint]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(entry: AchievementEvidence) {
    setEditing(entry);
    setForm(toForm(entry));
    setOpen(true);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function refreshLocal() {
    if (isGuest) setEntries(localListAchievementEvidence());
    else router.refresh();
  }

  async function save() {
    const input = toInput(form);
    if (!input.title.trim() || !input.result.trim()) return;
    setSaving(true);
    try {
      if (isGuest) {
        if (editing) localUpdateAchievementEvidence(editing.id, input);
        else localCreateAchievementEvidence(input);
      } else if (editing) {
        await updateAchievementEvidence(editing.id, input);
      } else {
        await createAchievementEvidence(input);
      }
      close();
      await refreshLocal();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    try {
      if (isGuest) localDeleteAchievementEvidence(editing.id);
      else await deleteAchievementEvidence(editing.id);
      close();
      await refreshLocal();
    } finally {
      setSaving(false);
    }
  }

  async function copyBullet(entry: AchievementEvidence) {
    const text = formatEvidenceBullet(entry);
    await navigator.clipboard.writeText(text);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1400);
  }

  return (
    <section
      className={compact ? 'rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-5' : ''}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className={compact ? 'text-lg font-bold' : 'text-2xl font-bold'}>
            Achievement Evidence
          </h2>
          {!compact && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Reusable quantified proof for resumes, cover letters, interviews, and recruiter
              replies.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium hover:bg-[var(--muted)]"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      {visibleEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm font-semibold text-foreground">No evidence saved yet</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Add proof once, reuse it everywhere.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleEntries.map((entry) => {
            const quality = scoreEvidenceQuality(entry);
            return (
              <article
                key={entry.id}
                className="rounded-xl border border-[var(--border)]/70 bg-background/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{entry.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
                      {formatEvidenceBullet(entry)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-[var(--primary)]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--primary)]">
                      {entry.impact_type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        quality === 'strong'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : quality === 'usable'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {quality}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {[...entry.skills, ...entry.role_targets].slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => copyBullet(entry)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-foreground"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    {copiedId === entry.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(entry)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <h3 className="mb-5 text-lg font-semibold">
              {editing ? 'Edit Evidence' : 'New Evidence'}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Title"
                value={form.title}
                onChange={(title) => setForm((prev) => ({ ...prev, title }))}
                placeholder="Cut checkout latency by 42%"
              />
              <Field
                label="Metric"
                value={form.metric}
                onChange={(metric) => setForm((prev) => ({ ...prev, metric }))}
                placeholder="42% faster, $120k saved"
              />
              <Field
                label="Scope"
                value={form.scope}
                onChange={(scope) => setForm((prev) => ({ ...prev, scope }))}
                placeholder="12-person team, 2M requests/day"
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                  Impact
                </span>
                <select
                  value={form.impact_type}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      impact_type: event.target.value as AchievementImpact,
                    }))
                  }
                  className="input-base"
                >
                  {IMPACT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Skills"
                value={form.skills}
                onChange={(skills) => setForm((prev) => ({ ...prev, skills }))}
                placeholder="React, systems, analytics"
              />
              <Field
                label="Role Targets"
                value={form.role_targets}
                onChange={(role_targets) => setForm((prev) => ({ ...prev, role_targets }))}
                placeholder="frontend, product engineer"
              />
            </div>
            <div className="mt-4 grid gap-4">
              <LongField
                label="Situation"
                value={form.situation}
                onChange={(situation) => setForm((prev) => ({ ...prev, situation }))}
              />
              <LongField
                label="Action"
                value={form.action}
                onChange={(action) => setForm((prev) => ({ ...prev, action }))}
              />
              <LongField
                label="Result"
                value={form.result}
                onChange={(result) => setForm((prev) => ({ ...prev, result }))}
              />
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div>
                {editing && (
                  <button
                    type="button"
                    onClick={remove}
                    disabled={saving}
                    className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={saving}
                  className="h-9 rounded-lg px-4 text-sm font-medium text-[var(--muted-foreground)] hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !form.title.trim() || !form.result.trim()}
                  className="h-9 rounded-lg bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input-base"
      />
    </label>
  );
}

function LongField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="input-base resize-y"
      />
    </label>
  );
}
