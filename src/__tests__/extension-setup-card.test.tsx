import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExtensionSetupCard } from '@/components/extension-setup-card';

describe('ExtensionSetupCard', () => {
  it('renders extension setup, provider coverage, and trust boundary', () => {
    render(<ExtensionSetupCard />);

    expect(screen.getByRole('heading', { name: 'Chrome extension' })).toBeDefined();
    expect(screen.getByText('Unpacked build')).toBeDefined();
    expect(screen.getByText('pnpm --dir extension build')).toBeDefined();
    expect(screen.getByText('extension/dist')).toBeDefined();
    expect(screen.getByText('https://rolepatch.com')).toBeDefined();

    for (const provider of [
      'Greenhouse',
      'Lever',
      'Workday',
      'Ashby',
      'Workable',
      'Recruitee',
      'Personio',
      'SmartRecruiters',
    ]) {
      expect(screen.getByText(provider)).toBeDefined();
    }

    expect(screen.getByText(/No all-site permission/i)).toBeDefined();
    expect(screen.getByText(/unattended bulk apply/i)).toBeDefined();
  });
});
