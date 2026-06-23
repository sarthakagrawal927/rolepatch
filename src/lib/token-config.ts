export const TOKEN_PACKS = [
  { id: 'starter', name: 'Starter', tokens: 10, price: 500, priceLabel: '$5', perToken: '$0.50' },
  {
    id: 'pro',
    name: 'Pro',
    tokens: 30,
    price: 1200,
    priceLabel: '$12',
    perToken: '$0.40',
    popular: true,
  },
  { id: 'bulk', name: 'Bulk', tokens: 100, price: 3000, priceLabel: '$30', perToken: '$0.30' },
] as const;

export function getProductId(packId: string): string | null {
  const envMap: Record<string, string | undefined> = {
    starter: process.env.DODO_PRODUCT_STARTER,
    pro: process.env.DODO_PRODUCT_PRO,
    bulk: process.env.DODO_PRODUCT_BULK,
  };
  return envMap[packId] ?? null;
}

export function getTokensForProduct(productId: string): number | null {
  for (const pack of TOKEN_PACKS) {
    const envId = getProductId(pack.id);
    if (envId === productId) return pack.tokens;
  }
  return null;
}
