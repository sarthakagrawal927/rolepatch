'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { signIn } from 'next-auth/react';

const TOKEN_PACKS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    tokens: 10,
    priceLabel: '$5',
    perToken: '$0.50',
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    tokens: 30,
    priceLabel: '$12',
    perToken: '$0.40',
    popular: true,
  },
  {
    id: 'bulk' as const,
    name: 'Bulk',
    tokens: 100,
    priceLabel: '$30',
    perToken: '$0.30',
  },
];

export function PricingCards() {
  const { isGuest } = useAuth();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(packId: string) {
    setError(null);
    setLoadingPack(packId);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Checkout failed');
      }
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoadingPack(null);
    }
  }

  return (
    <div>
      {isSuccess && (
        <div className="mb-8 p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-center">
          <p className="text-green-400 font-medium text-sm">
            Payment successful! Your tokens have been added to your account.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-8 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {TOKEN_PACKS.map((pack) => (
          <div
            key={pack.id}
            className={`relative rounded-xl border p-6 flex flex-col transition-colors ${
              pack.popular
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'
            }`}
          >
            {pack.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-green-500 text-[11px] font-semibold text-white uppercase tracking-wide">
                Popular
              </span>
            )}

            <h3 className="text-lg font-semibold text-white">{pack.name}</h3>
            <div className="mt-3">
              <span className="text-3xl font-bold text-white">{pack.priceLabel}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {pack.tokens} tokens &middot; {pack.perToken} each
            </p>

            <div className="mt-6 flex-1" />

            {isGuest ? (
              <button
                onClick={() => signIn('google')}
                className="w-full py-2.5 rounded-lg text-sm font-medium border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
              >
                Sign in to purchase
              </button>
            ) : (
              <button
                onClick={() => handleBuy(pack.id)}
                disabled={loadingPack !== null}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                  pack.popular
                    ? 'bg-green-500 text-white hover:bg-green-400'
                    : 'bg-white text-gray-900 hover:bg-gray-200'
                }`}
              >
                {loadingPack === pack.id ? 'Redirecting...' : 'Buy'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
