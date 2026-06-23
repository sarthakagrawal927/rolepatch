import type { Metadata } from 'next';

import { PricingCards } from '@/components/pricing-cards';
import { getTokenBalance } from '@/lib/actions/token-actions';
import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Token-based pricing for AI resume tailoring. Start with 3 free tokens. No subscription required.',
  alternates: { canonical: 'https://rolepatch.com/pricing' },
};

const FAQ = [
  {
    q: 'What can I do with tokens?',
    a: 'Each token lets you tailor a resume to a job description (1 token) or generate a cover letter (1 token). Editing, stash, and job tracking are always free.',
  },
  {
    q: 'Do tokens expire?',
    a: 'No. Tokens never expire -- use them whenever you need them.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Yes. Contact us within 14 days of purchase for a full refund.',
  },
];

async function hasRecentPayment(): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const result = await db.execute({
    sql: `SELECT id FROM payments WHERE user_id = ? AND status = 'completed' AND created_at > unixepoch() - 300 LIMIT 1`,
    args: [userId],
  });
  return result.rows.length > 0;
}

export default async function PricingPage() {
  const [balance, paymentVerified] = await Promise.all([getTokenBalance(), hasRecentPayment()]);

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground">Get Tokens</h1>
        <p className="text-[var(--muted-foreground)] mt-3">
          Each token lets you tailor a resume, score job fit, generate interview stories, or write a
          cover letter.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--card)] border border-[var(--border)]">
          <span className="text-[var(--accent)] font-black text-xl">{balance}</span>
          <span className="text-sm text-[var(--muted-foreground)]">tokens remaining</span>
        </div>
      </div>

      <PricingCards paymentVerified={paymentVerified} />

      {/* FAQ */}
      <div className="mt-20 space-y-4 max-w-2xl mx-auto">
        <h2 className="font-serif text-2xl font-bold text-center text-foreground mb-8">FAQ</h2>
        {FAQ.map((faq) => (
          <div
            key={faq.q}
            className="border border-[var(--border)] rounded-xl p-5 bg-[var(--card)]"
          >
            <h3 className="font-bold text-foreground text-sm">{faq.q}</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1.5 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
