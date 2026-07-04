import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProofProjectOverview } from '@/components/proof-project-overview';

describe('ProofProjectOverview', () => {
  it('frames TrueHire as a separate proof project under RolePatch', () => {
    render(<ProofProjectOverview />);

    expect(screen.getByText('TrueHire proof project')).toBeDefined();
    expect(screen.getByRole('heading', { name: /your resume can be tailored/i })).toBeDefined();
    expect(screen.getByText(/stays as the credibility layer under RolePatch/i)).toBeDefined();
    expect(screen.getByText('Separate by default')).toBeDefined();
    expect(screen.getByText(/TrueHire is the public proof lane/i)).toBeDefined();
  });

  it('connects proof artifacts to evidence, packets, receipts, and replies', () => {
    render(<ProofProjectOverview />);

    expect(screen.getByText('Public work')).toBeDefined();
    expect(screen.getByText('Application proof')).toBeDefined();
    expect(screen.getByText('Recruiter evidence')).toBeDefined();
    expect(screen.getAllByText('Derived, not declared').length).toBeGreaterThan(0);
    expect(screen.getByText(/Packets and receipts preserve source links/i)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open evidence bank' })).toHaveAttribute(
      'href',
      '/evidence'
    );
    expect(screen.getByRole('link', { name: 'Review apply packets' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });
});
