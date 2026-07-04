import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PricingCards } from '@/components/pricing-cards';

const mockUseAuth = vi.fn(() => ({ isGuest: false }));
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockSignInSocial = vi.fn();
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) => mockSignInSocial(...args),
    },
  },
}));

vi.mock('@/lib/foundry-monitoring', () => ({
  captureAuthFailure: vi.fn(),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockUseAuth.mockReturnValue({ isGuest: false });
  mockSignInSocial.mockReset();
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('PricingCards', () => {
  it('explains apply-agent workflow pricing without subscription claims', () => {
    render(<PricingCards paymentVerified={false} />);

    expect(screen.getByText('Free reviewed workflow')).toBeDefined();
    expect(screen.getByText(/Queue jobs, prepare packets, fill with the extension/i)).toBeDefined();
    expect(screen.getByText('Tokens fund AI work')).toBeDefined();
    expect(screen.getByText(/tailoring, cover letters, fit scoring/i)).toBeDefined();
    expect(screen.getByText('No subscription')).toBeDefined();
    expect(screen.getByText(/does not become unattended bulk apply/i)).toBeDefined();
  });

  it('shows safe checkout failure copy without raw provider details', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'Checkout is temporarily unavailable. Try again in a few minutes.',
          detail: { reason: 'provider_unavailable', retryable: true },
        }),
        { status: 502, headers: { 'content-type': 'application/json' } }
      )
    );

    render(<PricingCards paymentVerified={false} />);

    await user.click(screen.getAllByRole('button', { name: 'Buy' })[0]);

    expect(
      await screen.findByText('Checkout is temporarily unavailable. Try again in a few minutes.')
    ).toBeDefined();
    expect(screen.queryByText(/provider_unavailable/i)).toBeNull();
    expect(screen.queryByText(/Dodo/i)).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId: 'starter' }),
    });
  });

  it('prompts guests to sign in before checkout', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ isGuest: true });
    mockSignInSocial.mockResolvedValueOnce({});

    render(<PricingCards paymentVerified={false} />);

    await user.click(screen.getAllByRole('button', { name: 'Sign in to purchase' })[0]);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/pricing',
    });
  });
});
