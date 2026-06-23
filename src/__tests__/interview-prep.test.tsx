import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InterviewPrep } from '@/components/interview-prep';
import type { InterviewStory, JobApplication, Resume } from '@/lib/types';

// Mock auth provider
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ isGuest: true }),
}));

// Mock server action
vi.mock('@/lib/actions/interview-prep-action', () => ({
  generateInterviewStories: vi.fn(),
}));

const mockJob: JobApplication = {
  id: 'job-1',
  resume_id: 'res-1',
  url: 'https://example.com/job',
  company: 'Acme Corp',
  role: 'Senior Engineer',
  jd_raw: '',
  jd_text: 'We need a senior engineer with React and Node.js experience.',
  status: 'draft',
  interview_date: null,
  follow_up_at: null,
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  offer_amount: null,
  notes: null,
  rejection_reason: null,
  created_at: 1712000000,
  updated_at: 1712000000,
};

const mockResume: Resume = {
  id: 'res-1',
  name: 'My Resume',
  source: '# John Doe\nSenior Engineer with 8 years experience.',
  created_at: 1712000000,
  updated_at: 1712000000,
};

const mockStories: InterviewStory[] = [
  {
    id: 'story-1',
    job_id: 'job-1',
    theme: 'Technical Leadership',
    jd_requirement: 'Lead cross-functional teams',
    situation: 'At Company X, we had a critical migration.',
    task: 'I needed to coordinate 3 teams.',
    action: 'I set up weekly syncs and a shared dashboard.',
    result: 'Completed migration 2 weeks early.',
    reflection: 'I learned the value of over-communication.',
    best_for: ['leadership', 'cross-functional', 'project management'],
    created_at: 1712000000,
  },
  {
    id: 'story-2',
    job_id: 'job-1',
    theme: 'Problem Solving',
    jd_requirement: 'Debug complex distributed systems',
    situation: 'Production was down for 2 hours.',
    task: 'Find root cause in a microservices architecture.',
    action: 'Used distributed tracing to isolate the failing service.',
    result: 'Identified a race condition, deployed fix in 30 minutes.',
    reflection: 'Added circuit breakers to prevent cascading failures.',
    best_for: ['debugging', 'system design', 'incident response'],
    created_at: 1712000000,
  },
];

describe('InterviewPrep', () => {
  it('renders empty state when no stories', () => {
    render(<InterviewPrep job={mockJob} resume={mockResume} existingStories={[]} />);
    expect(screen.getByText('No interview stories yet')).toBeDefined();
    expect(screen.getByText('Generate Stories')).toBeDefined();
  });

  it('renders stories when provided', () => {
    render(<InterviewPrep job={mockJob} resume={mockResume} existingStories={mockStories} />);
    expect(screen.getByText('Technical Leadership')).toBeDefined();
    expect(screen.getByText('Problem Solving')).toBeDefined();
    expect(screen.getByText('Regenerate Stories')).toBeDefined();
  });

  it('expands a story card on click', async () => {
    render(<InterviewPrep job={mockJob} resume={mockResume} existingStories={mockStories} />);
    const user = userEvent.setup();

    // STAR content not visible initially
    expect(screen.queryByText('At Company X, we had a critical migration.')).toBeNull();

    // Click to expand
    await user.click(screen.getByText('Technical Leadership'));

    // STAR sections now visible
    expect(screen.getByText('At Company X, we had a critical migration.')).toBeDefined();
    expect(screen.getByText('I needed to coordinate 3 teams.')).toBeDefined();
    expect(screen.getByText('Completed migration 2 weeks early.')).toBeDefined();
    expect(screen.getByText('I learned the value of over-communication.')).toBeDefined();
  });

  it('shows question coverage tags', () => {
    render(<InterviewPrep job={mockJob} resume={mockResume} existingStories={mockStories} />);
    expect(screen.getByText(/leadership/)).toBeDefined();
    expect(screen.getByText(/debugging/)).toBeDefined();
  });

  it('shows job context in header', () => {
    render(<InterviewPrep job={mockJob} resume={mockResume} existingStories={mockStories} />);
    expect(screen.getByText('Senior Engineer')).toBeDefined();
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
});
