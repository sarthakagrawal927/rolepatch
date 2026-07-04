'use client';

import { Check, Copy, Mail, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

import { sendRecruiterReply } from '@/lib/actions/recruiter-reply-actions';
import type { RecruiterReplyEvent } from '@/lib/types';

interface RecruiterReplyRoutingCardProps {
  address: string | null;
  events: RecruiterReplyEvent[];
}

function eventLabel(event: RecruiterReplyEvent): string {
  if (event.applied_status) return `Moved to ${event.applied_status}`;
  if (event.job_id) return 'Matched, no status change';
  return 'Needs review';
}

export function RecruiterReplyRoutingCard({ address, events }: RecruiterReplyRoutingCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [replyEvents, setReplyEvents] = useState(events);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [sendError, setSendError] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const threads = useMemo(() => {
    const map = new Map<string, RecruiterReplyEvent[]>();
    for (const event of replyEvents) {
      const key = event.thread_key || event.message_id || event.subject;
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        latest: items.slice().sort((a, b) => b.created_at - a.created_at)[0],
        count: items.length,
      }))
      .filter((thread): thread is { key: string; latest: RecruiterReplyEvent; count: number } =>
        Boolean(thread.latest)
      )
      .sort((a, b) => b.latest.created_at - a.latest.created_at);
  }, [replyEvents]);

  if (!address) return null;

  return (
    <section className="mb-12 rounded-2xl border border-[var(--border)]/60 bg-[var(--card)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent">
            <Mail className="h-3.5 w-3.5" />
            Reply routing
          </div>
          <h2 className="text-xl font-bold">Recruiter replies</h2>
          <p className="mt-1 max-w-2xl text-xs font-medium text-[var(--muted-foreground)] opacity-75">
            Forward recruiter emails here. RolePatch links confident replies to applications and
            updates interview, offer, or rejection status.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border)] bg-muted/20 px-3 py-2 font-mono text-xs text-foreground">
        {address}
      </div>

      {threads.length > 0 && (
        <div className="mt-4 space-y-2">
          {threads.slice(0, 4).map(({ key, latest: event, count }) => (
            <div
              key={key}
              className="rounded-lg border border-[var(--border)]/60 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-foreground">{eventLabel(event)}</span>
                <span className="text-[var(--muted-foreground)]">{event.subject}</span>
                {count > 1 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                    {count} replies
                  </span>
                )}
                <span className="ml-auto text-[var(--muted-foreground)]">
                  {new Date(event.created_at * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="mt-2 rounded-lg bg-muted/30 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted-foreground)]">
                    Suggested reply
                  </p>
                  {event.reply_sent_at && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                      Sent {new Date(event.reply_sent_at * 1000).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={drafts[event.id]?.subject ?? event.suggested_reply_subject}
                  onChange={(e) =>
                    setDrafts((current) => ({
                      ...current,
                      [event.id]: {
                        subject: e.target.value,
                        body: current[event.id]?.body ?? event.suggested_reply_body,
                      },
                    }))
                  }
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 font-bold text-foreground"
                />
                <textarea
                  value={drafts[event.id]?.body ?? event.suggested_reply_body}
                  onChange={(e) =>
                    setDrafts((current) => ({
                      ...current,
                      [event.id]: {
                        subject: current[event.id]?.subject ?? event.suggested_reply_subject,
                        body: e.target.value,
                      },
                    }))
                  }
                  rows={4}
                  className="mt-2 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[var(--muted-foreground)]"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const draft = drafts[event.id] ?? {
                        subject: event.suggested_reply_subject,
                        body: event.suggested_reply_body,
                      };
                      await navigator.clipboard.writeText(
                        `Subject: ${draft.subject}\n\n${draft.body}`
                      );
                      setCopiedDraftId(event.id);
                      window.setTimeout(() => setCopiedDraftId(null), 1500);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] hover:bg-muted"
                  >
                    {copiedDraftId === event.id ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedDraftId === event.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    disabled={sendingId === event.id || Boolean(event.reply_sent_at)}
                    onClick={async () => {
                      const draft = drafts[event.id] ?? {
                        subject: event.suggested_reply_subject,
                        body: event.suggested_reply_body,
                      };
                      setSendingId(event.id);
                      setSendError((current) => ({ ...current, [event.id]: '' }));
                      const result = await sendRecruiterReply(event.id, draft.subject, draft.body);
                      if (!result.ok) {
                        setSendError((current) => ({
                          ...current,
                          [event.id]: result.error ?? 'Could not send reply.',
                        }));
                        setSendingId(null);
                        return;
                      }
                      setReplyEvents((current) =>
                        current.map((item) =>
                          item.id === event.id
                            ? {
                                ...item,
                                reply_sent_at:
                                  result.reply_sent_at ?? Math.floor(Date.now() / 1000),
                                reply_sent_subject: draft.subject,
                                reply_sent_body: draft.body,
                                reply_send_error: null,
                              }
                            : item
                        )
                      );
                      setSendingId(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--primary)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--primary-foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-3 w-3" />
                    {sendingId === event.id ? 'Sending' : event.reply_sent_at ? 'Sent' : 'Send'}
                  </button>
                  {(sendError[event.id] || event.reply_send_error) && (
                    <span className="text-[10px] font-semibold text-red-600">
                      {sendError[event.id] || event.reply_send_error}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
