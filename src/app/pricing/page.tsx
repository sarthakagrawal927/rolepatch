import { getTokenBalance } from '@/lib/actions/token-actions';
import { PricingCards } from '@/components/pricing-cards';

export const dynamic = 'force-dynamic';

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

export default async function PricingPage() {
  const balance = await getTokenBalance();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Get Tokens</h1>
        <p className="text-gray-400 mt-2">
          Each token lets you tailor one resume or generate one cover letter.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 border border-gray-700">
          <span className="text-green-400 font-bold text-lg">{balance}</span>
          <span className="text-sm text-gray-400">tokens remaining</span>
        </div>
      </div>

      <PricingCards />

      {/* FAQ */}
      <div className="mt-16 space-y-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold text-center">FAQ</h2>
        {FAQ.map((faq) => (
          <div key={faq.q} className="border border-gray-800 rounded-xl p-5">
            <h3 className="font-medium text-white text-sm">{faq.q}</h3>
            <p className="text-sm text-gray-400 mt-1">{faq.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
