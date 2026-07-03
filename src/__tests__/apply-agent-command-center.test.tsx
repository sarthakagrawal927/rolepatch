import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApplyAgentCommandCenter } from '@/components/apply-agent-command-center';
import type { ApplicationQueueEntry, JobApplication } from '@/lib/types';

const baseJob = {
  id: 'job-1',
  company: 'Stripe',
  role: 'Backend Engineer',
  updated_at: 1_720_000_000,
} satisfies Omit<
  JobApplication,
  | 'resume_id'
  | 'url'
  | 'jd_raw'
  | 'jd_text'
  | 'status'
  | 'created_at'
  | 'interview_date'
  | 'follow_up_at'
  | 'salary_min'
  | 'salary_max'
  | 'salary_currency'
  | 'offer_amount'
  | 'notes'
  | 'rejection_reason'
>;

function job(
  status: JobApplication['status'],
  overrides: Partial<typeof baseJob> = {}
): Pick<JobApplication, 'id' | 'resume_id' | 'url' | 'company' | 'role' | 'status' | 'updated_at'> {
  return {
    resume_id: 'resume-1',
    url: 'https://boards.greenhouse.io/example/jobs/1',
    ...baseJob,
    ...overrides,
    status,
  };
}

function queueEntry(
  jobId: string,
  overrides: Partial<ApplicationQueueEntry> = {}
): ApplicationQueueEntry {
  return {
    id: `queue-${jobId}`,
    job_id: jobId,
    status: 'queued',
    readiness: {
      status: 'ready_for_review',
      summary: 'Tailored materials are ready; review missing optional answers before submit.',
      missing: ['profile answers'],
      checks: {
        resume: true,
        tailored_resume: true,
        cover_letter: false,
        profile_answers: false,
        receipt: false,
      },
    },
    created_at: 1_720_000_000,
    updated_at: 1_720_000_000,
    ...overrides,
  };
}

const noop = async () => {};

function renderCommandCenter(props: Partial<ComponentProps<typeof ApplyAgentCommandCenter>> = {}) {
  return render(
    <ApplyAgentCommandCenter
      resumeCount={1}
      jobs={[]}
      queue={[]}
      receipts={[]}
      packets={[]}
      profileAnswers={[]}
      discoveryAlerts={[]}
      fitScores={{}}
      onQueueApplication={noop}
      onQueueDiscoveryAlert={noop}
      onQueueReadyApplications={noop}
      onRefreshReadiness={noop}
      onUpdateQueueStatus={noop}
      onBulkUpdateQueueStatus={noop}
      onRetryQueueEntry={noop}
      onRecordManualReceipt={noop}
      onRunBrowserCheck={noop}
      onRunBrowserCheckBatch={noop}
      onRunGuardedSubmit={noop}
      onRunGuardedSubmitBatch={noop}
      onSaveProfileAnswer={noop}
      onDeleteProfileAnswer={noop}
      {...props}
    />
  );
}

describe('ApplyAgentCommandCenter', () => {
  it('counts readiness states from existing applications', () => {
    renderCommandCenter({
      jobs: [
        job('draft', { id: 'draft' }),
        job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' }),
        job('applied', { id: 'applied' }),
        job('interview', { id: 'interview' }),
      ],
    });

    expect(screen.getByText('Command center')).toBeDefined();
    expect(screen.getByText('Needs tailoring')).toBeDefined();
    expect(screen.getByText('Ready for review')).toBeDefined();
    expect(screen.getByText('Submitted / tracked')).toBeDefined();
    expect(screen.getByText('Review Frontend Engineer at Vercel before submitting.')).toBeDefined();
  });

  it('marks guarded submit live while bulk unattended apply remains planned', () => {
    renderCommandCenter({ resumeCount: 0 });

    expect(screen.getByText(/Guarded submit is live/i)).toBeDefined();
    expect(screen.getAllByText('Planned')).toHaveLength(1);
    expect(screen.getByText('Guarded browser submit')).toBeDefined();
    expect(screen.getByText('Bulk unattended apply')).toBeDefined();
    expect(screen.getByText('Needed')).toBeDefined();
    expect(
      screen.getByText('Create a base resume before building an application queue.')
    ).toBeDefined();
  });

  it('renders queued applications and receipt status', () => {
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      receipts: [
        {
          id: 'receipt-1',
          job_id: 'tailored',
          queue_id: 'queue-tailored',
          provider: 'greenhouse',
          status: 'submitted',
          fields: [],
          resume_id: 'resume-1',
          cover_letter_id: null,
          confirmation_text: 'Marked submitted manually in RolePatch.',
          confirmation_url: null,
          failure_reason: null,
          created_at: 1_720_000_000,
        },
      ],
    });

    expect(screen.getByText('Application queue')).toBeDefined();
    expect(screen.getAllByText('Frontend Engineer').length).toBeGreaterThan(0);
    expect(screen.getByText(/Receipt: greenhouse/)).toBeDefined();
  });

  it('renders automation health from browser receipts', () => {
    renderCommandCenter({
      receipts: [
        {
          id: 'receipt-1',
          job_id: 'job-1',
          queue_id: 'queue-1',
          provider: 'lever',
          status: 'submitted',
          fields: [
            { label: 'Browser runner mode', value: 'Guarded browser submit', source: 'system' },
            { label: 'Failure code', value: 'none', source: 'system' },
          ],
          resume_id: 'resume-1',
          cover_letter_id: null,
          confirmation_text: 'Guarded submit completed.',
          confirmation_url: 'https://jobs.lever.co/acme/thanks',
          failure_reason: null,
          created_at: 1_720_000_000,
        },
        {
          id: 'receipt-2',
          job_id: 'job-2',
          queue_id: 'queue-2',
          provider: 'lever',
          status: 'failed',
          fields: [
            { label: 'Browser runner mode', value: 'Guarded browser submit', source: 'system' },
            { label: 'Failure code', value: 'missing_required_fields', source: 'system' },
          ],
          resume_id: 'resume-1',
          cover_letter_id: null,
          confirmation_text: 'Guarded submit blocked.',
          confirmation_url: null,
          failure_reason: null,
          created_at: 1_720_000_001,
        },
      ],
    });

    expect(screen.getByText('Automation health')).toBeDefined();
    expect(screen.getByText('1/2')).toBeDefined();
    expect(screen.getByText(/1 submitted · 1 blocked · 2 total/i)).toBeDefined();
    expect(screen.getByText(/missing required fields · lever/i)).toBeDefined();
  });

  it('renders remediation from browser failure codes', () => {
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'needs_user' })],
      receipts: [
        {
          id: 'receipt-1',
          job_id: 'tailored',
          queue_id: 'queue-tailored',
          provider: 'greenhouse',
          status: 'failed',
          fields: [{ label: 'Failure code', value: 'missing_required_fields', source: 'system' }],
          resume_id: 'resume-1',
          cover_letter_id: null,
          confirmation_text: 'Guarded submit blocked: required fields are empty.',
          confirmation_url: null,
          failure_reason: null,
          created_at: 1_720_000_000,
        },
      ],
    });

    expect(screen.getByText(/Next: Save Greenhouse answers/i)).toBeDefined();
    expect(screen.getByText(/Greenhouse fields are usually single-page/i)).toBeDefined();
  });

  it('renders saved profile answers', () => {
    renderCommandCenter({
      profileAnswers: [
        {
          id: 'profile-1',
          category: 'work_authorization',
          label: 'Authorized to work in US?',
          answer: 'Yes, authorized to work in the United States.',
          sensitive: 1,
          created_at: 1_720_000_000,
          updated_at: 1_720_000_000,
        },
      ],
    });

    expect(screen.getAllByText('Profile answers').length).toBeGreaterThan(0);
    expect(screen.getByText('Authorized to work in US?')).toBeDefined();
    expect(screen.getByText(/authorized to work in the United States/i)).toBeDefined();
  });

  it('renders match feed ranked by fit score', () => {
    renderCommandCenter({
      jobs: [
        job('draft', { id: 'draft', role: 'Backend Engineer', company: 'Stripe' }),
        job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' }),
      ],
      fitScores: { draft: 65, tailored: 88 },
    });

    expect(screen.getByText('Match feed')).toBeDefined();
    expect(screen.getByText('Frontend Engineer')).toBeDefined();
    expect(screen.getByText('Fit 88')).toBeDefined();
  });

  it('renders actionable discovery alerts in the apply-agent feed', async () => {
    const user = userEvent.setup();
    const onQueueDiscoveryAlert = vi.fn(async () => {});
    renderCommandCenter({
      discoveryAlerts: [
        {
          id: 'alert-1',
          alert_type: 'new_match',
          title: 'Platform Engineer',
          detail: 'Acme · Remote',
          company: 'Acme',
          job_url: 'https://boards.greenhouse.io/acme/jobs/1',
          location: 'Remote',
          source: 'greenhouse',
          seen: 0,
          created_at: 1_720_000_000,
        },
      ],
      onQueueDiscoveryAlert,
    });

    expect(screen.getByText('Discovery alerts')).toBeDefined();
    expect(screen.getByText('Platform Engineer')).toBeDefined();
    await user.click(screen.getByText('Add to queue'));
    expect(onQueueDiscoveryAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'alert-1',
        job_url: 'https://boards.greenhouse.io/acme/jobs/1',
      })
    );
  });

  it('renders queue filters and prepared packet', async () => {
    const user = userEvent.setup();
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      profileAnswers: [
        {
          id: 'profile-1',
          category: 'links',
          label: 'Portfolio URL',
          answer: 'https://example.com',
          sensitive: 0,
          created_at: 1_720_000_000,
          updated_at: 1_720_000_000,
        },
      ],
    });

    expect(screen.getByText('Ready 1')).toBeDefined();
    await user.click(screen.getByText('Packet'));
    expect(screen.getByText('Prepared application packet')).toBeDefined();
    expect(screen.getAllByText('Portfolio URL').length).toBeGreaterThan(0);
  });

  it('bulk updates selected queue entries without marking them submitted', async () => {
    const user = userEvent.setup();
    const onBulkUpdateQueueStatus = vi.fn(async () => {});
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      onBulkUpdateQueueStatus,
    });

    await user.click(screen.getByText('Select visible'));
    await user.click(screen.getByText('Mark ready'));

    expect(onBulkUpdateQueueStatus).toHaveBeenCalledWith(['queue-tailored'], 'ready_to_submit');
    expect(screen.queryByText('Mark submitted')).toBeDefined();
  });

  it('runs reviewed browser check for a queued application', async () => {
    const user = userEvent.setup();
    const onRunBrowserCheck = vi.fn(async () => {});
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      onRunBrowserCheck,
    });

    await user.click(screen.getByText('Browser check'));

    expect(onRunBrowserCheck).toHaveBeenCalledWith('queue-tailored');
  });

  it('runs reviewed browser checks for selected queue entries', async () => {
    const user = userEvent.setup();
    const onRunBrowserCheckBatch = vi.fn(async () => {});
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      onRunBrowserCheckBatch,
    });

    await user.click(screen.getByText('Select visible'));
    await user.click(screen.getByText('Run checks'));

    expect(onRunBrowserCheckBatch).toHaveBeenCalledWith(['queue-tailored']);
  });

  it('retries failed queue entries', async () => {
    const user = userEvent.setup();
    const onRetryQueueEntry = vi.fn(async () => {});
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'failed' })],
      onRetryQueueEntry,
    });

    await user.click(screen.getByText('Retry'));

    expect(onRetryQueueEntry).toHaveBeenCalledWith('queue-tailored');
  });

  it('runs guarded submit for ready queue entries after confirmation', async () => {
    const user = userEvent.setup();
    const onRunGuardedSubmit = vi.fn(async () => {});
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      onRunGuardedSubmit,
    });

    await user.click(screen.getAllByText('Auto submit').at(-1)!);

    expect(onRunGuardedSubmit).toHaveBeenCalledWith('queue-tailored');
  });

  it('runs guarded submit for selected ready queue entries after confirmation', async () => {
    const user = userEvent.setup();
    const onRunGuardedSubmitBatch = vi.fn(async () => {});
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      onRunGuardedSubmitBatch,
    });

    await user.click(screen.getByText('Select visible'));
    await user.click(screen.getAllByText('Auto submit')[0]);

    expect(onRunGuardedSubmitBatch).toHaveBeenCalledWith(['queue-tailored']);
  });
});
