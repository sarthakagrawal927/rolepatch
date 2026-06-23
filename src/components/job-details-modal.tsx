'use client';

import { useCallback, useEffect, useState } from 'react';

import type { JobDetailsPatch } from '@/lib/types';

export interface JobDetailsModalInitialValues {
  interview_date: number | null;
  follow_up_at: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  offer_amount: number | null;
  notes: string | null;
  rejection_reason: string | null;
}

interface JobDetailsModalProps {
  open: boolean;
  jobTitle: string;
  company: string;
  initial: JobDetailsModalInitialValues;
  onClose: () => void;
  onSave: (patch: JobDetailsPatch) => Promise<void> | void;
}

// unix seconds ↔ <input type="datetime-local"> ("YYYY-MM-DDTHH:MM")
function unixToLocalInput(unix: number | null): string {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToUnix(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

// dollars ↔ cents
function centsToDollars(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

export function JobDetailsModal({
  open,
  jobTitle,
  company,
  initial,
  onClose,
  onSave,
}: JobDetailsModalProps) {
  const [interviewDate, setInterviewDate] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form from `initial` every time modal opens
  useEffect(() => {
    if (!open) return;
    setInterviewDate(unixToLocalInput(initial.interview_date));
    setFollowUpAt(unixToLocalInput(initial.follow_up_at));
    setSalaryMin(centsToDollars(initial.salary_min));
    setSalaryMax(centsToDollars(initial.salary_max));
    setSalaryCurrency(initial.salary_currency ?? '');
    setOfferAmount(centsToDollars(initial.offer_amount));
    setNotes(initial.notes ?? '');
    setRejectionReason(initial.rejection_reason ?? '');
    setError('');
  }, [open, initial]);

  const close = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

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

    const currency = salaryCurrency.trim().toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency)) {
      setError('Currency must be a 3-letter ISO 4217 code (e.g. USD)');
      return;
    }

    const patch: JobDetailsPatch = {
      interview_date: localInputToUnix(interviewDate),
      follow_up_at: localInputToUnix(followUpAt),
      salary_min: dollarsToCents(salaryMin),
      salary_max: dollarsToCents(salaryMax),
      salary_currency: currency || null,
      offer_amount: dollarsToCents(offerAmount),
      notes: notes.trim() || null,
      rejection_reason: rejectionReason.trim() || null,
    };

    setSaving(true);
    setError('');
    try {
      await onSave(patch);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 modal-backdrop" onClick={close} />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 modal-content max-h-[90vh] overflow-y-auto">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-foreground">{jobTitle || 'Untitled Role'}</h2>
          <p className="text-xs font-medium text-[var(--muted-foreground)] opacity-70">
            {company || 'Unknown Company'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                Interview
              </label>
              <input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                Follow-up
              </label>
              <input
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="input-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_90px] gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                Salary min
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="0.00"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                Salary max
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="0.00"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
                Cur
              </label>
              <input
                type="text"
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value)}
                placeholder="USD"
                maxLength={3}
                className="input-base uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
              Offer amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="0.00"
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Recruiter name, interviewer, prep notes..."
              className="input-base resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">
              Rejection reason
            </label>
            <input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Optional"
              className="input-base"
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--destructive)] bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
