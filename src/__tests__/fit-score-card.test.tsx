import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FitScoreBadge, FitScoreCard } from '@/components/fit-score-card';
import type { FitScore } from '@/lib/types';

const mockFitScore: FitScore = {
  id: 'fs-1',
  job_id: 'job-1',
  overall_score: 78,
  dimensions: [
    { name: 'Role Alignment', score: 85, weight: 25, detail: 'Strong match with backend focus.' },
    { name: 'Skills Match', score: 72, weight: 25, detail: 'Covers 8 of 11 required skills.' },
    { name: 'Experience Level', score: 80, weight: 20, detail: 'Seniority aligns well.' },
    { name: 'Keyword Coverage', score: 68, weight: 15, detail: 'Missing: Kubernetes, Terraform.' },
    { name: 'Culture & Logistics', score: 75, weight: 15, detail: 'Remote-friendly role.' },
  ],
  strengths: ['Strong backend experience', 'Relevant domain knowledge'],
  gaps: ['Missing cloud certifications'],
  recommendation: 'Strong fit overall. Focus on highlighting cloud experience.',
  created_at: 1712000000,
};

describe('FitScoreCard', () => {
  it('renders overall score and grade', () => {
    render(<FitScoreCard fitScore={mockFitScore} />);
    expect(screen.getByText('78')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('Job Fit Score')).toBeDefined();
  });

  it('expands to show dimensions on click', async () => {
    render(<FitScoreCard fitScore={mockFitScore} />);
    const user = userEvent.setup();

    // Dimensions not visible initially
    expect(screen.queryByText('Role Alignment')).toBeNull();

    // Click to expand
    await user.click(screen.getByText('Job Fit Score'));

    // Now dimensions visible
    expect(screen.getByText('Role Alignment')).toBeDefined();
    expect(screen.getByText('Skills Match')).toBeDefined();
    expect(screen.getByText('Strong backend experience')).toBeDefined();
    expect(screen.getByText('Missing cloud certifications')).toBeDefined();
    expect(screen.getByText(/Strong fit overall/)).toBeDefined();
  });
});

describe('FitScoreBadge', () => {
  it('renders grade and score', () => {
    render(<FitScoreBadge score={78} />);
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('78')).toBeDefined();
  });

  it('shows A grade for score >= 90', () => {
    render(<FitScoreBadge score={92} />);
    expect(screen.getByText('A')).toBeDefined();
  });

  it('shows F grade for very low score', () => {
    render(<FitScoreBadge score={25} />);
    expect(screen.getByText('F')).toBeDefined();
  });
});
