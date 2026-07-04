import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApplicationCampaignTracker } from '@/components/application-campaign-tracker';
import type { CampaignJob } from '@/lib/application-campaign';

const now = 1_775_772_000;

function job(overrides: Partial<CampaignJob> = {}): CampaignJob {
  return {
    id: overrides.id ?? 'job-1',
    company: overrides.company ?? 'Acme',
    role: overrides.role ?? 'Staff Engineer',
    status: overrides.status ?? 'applied',
    created_at: overrides.created_at ?? now,
    follow_up_at: overrides.follow_up_at ?? now - 60,
    interview_date: overrides.interview_date ?? null,
    notes: overrides.notes ?? null,
  };
}

describe('ApplicationCampaignTracker', () => {
  it('renders contact search links and keeps details as an explicit action', async () => {
    const user = userEvent.setup();
    const onOpenDetails = vi.fn();
    render(<ApplicationCampaignTracker jobs={[job()]} onOpenDetails={onOpenDetails} />);

    const recruiterLink = screen.getByRole('link', { name: 'Find recruiter' });
    const hiringManagerLink = screen.getByRole('link', { name: 'Find hiring manager' });

    expect(decodeURIComponent(recruiterLink.getAttribute('href') ?? '')).toContain(
      'site:linkedin.com/in "recruiter" "Acme"'
    );
    expect(decodeURIComponent(hiringManagerLink.getAttribute('href') ?? '')).toContain(
      'site:linkedin.com/in "Staff Engineer hiring manager" "Acme"'
    );

    await user.click(screen.getByRole('button', { name: 'Details' }));

    expect(onOpenDetails).toHaveBeenCalledWith('job-1');
  });
});
