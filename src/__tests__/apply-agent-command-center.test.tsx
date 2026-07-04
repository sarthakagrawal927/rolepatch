import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApplyAgentCommandCenter } from '@/components/apply-agent-command-center';
import type {
  ApplicationPacket,
  ApplicationQueueEntry,
  ApplicationReceipt,
  JobApplication,
} from '@/lib/types';

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
  overrides: Partial<
    Pick<JobApplication, 'id' | 'company' | 'role' | 'updated_at' | 'notes' | 'url'>
  > = {}
): Pick<
  JobApplication,
  'id' | 'resume_id' | 'url' | 'company' | 'role' | 'status' | 'updated_at' | 'notes'
> {
  return {
    resume_id: 'resume-1',
    url: 'https://boards.greenhouse.io/example/jobs/1',
    notes: null,
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

function receipt(overrides: Partial<ApplicationReceipt> = {}): ApplicationReceipt {
  return {
    id: 'receipt-1',
    job_id: 'tailored',
    queue_id: 'queue-tailored',
    provider: 'greenhouse',
    status: 'failed',
    fields: [
      { label: 'Browser runner mode', value: 'Guarded browser submit', source: 'system' },
      { label: 'Failure code', value: 'missing_required_fields', source: 'system' },
      {
        label: 'Blocked reasons',
        value: 'Required fields are empty: Work authorization, Sponsorship',
        source: 'system',
      },
    ],
    resume_id: 'resume-1',
    cover_letter_id: null,
    confirmation_text: 'Guarded submit blocked.',
    confirmation_url: null,
    failure_reason: null,
    created_at: 1_720_000_000,
    ...overrides,
  };
}

function guardedSubmitReceipt(overrides: Partial<ApplicationReceipt> = {}): ApplicationReceipt {
  return receipt({
    status: 'submitted',
    confirmation_text: 'Guarded submit completed.',
    confirmation_url: 'https://boards.greenhouse.io/example/jobs/thanks',
    fields: [
      { label: 'Browser runner mode', value: 'Guarded browser submit', source: 'system' },
      { label: 'Failure code', value: 'none', source: 'system' },
    ],
    ...overrides,
  });
}

const noop = async () => {};
const requiredSafetyAnswers = [
  {
    id: 'profile-work-auth',
    category: 'work_authorization' as const,
    label: 'Authorized to work in US?',
    answer: 'Yes, authorized to work in the United States.',
    sensitive: 1,
    created_at: 1_720_000_000,
    updated_at: 1_720_000_000,
  },
  {
    id: 'profile-sponsorship',
    category: 'sponsorship' as const,
    label: 'Need sponsorship?',
    answer: 'No sponsorship required.',
    sensitive: 1,
    created_at: 1_720_000_000,
    updated_at: 1_720_000_000,
  },
];

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
      onQueueDiscoveryAlerts={noop}
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
    expect(screen.getByText('Apply mode gates')).toBeDefined();
    expect(screen.getByText('Review mode')).toBeDefined();
    expect(screen.getByText('Assisted fill')).toBeDefined();
    expect(screen.getByText('Unattended apply')).toBeDefined();
    expect(screen.getByText('Needs answers')).toBeDefined();
    expect(screen.getByText('Locked')).toBeDefined();
    expect(screen.getByText(/explicit user approval before it can ship/i)).toBeDefined();
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
    expect(screen.getByText('Cover letter')).toBeDefined();
    expect(screen.getByText('generate letter')).toBeDefined();
    expect(screen.getByText(/Receipt: greenhouse/)).toBeDefined();
  });

  it('summarizes aggregate queue safety status', () => {
    renderCommandCenter({
      jobs: [
        job('tailored', {
          id: 'low-fit',
          role: 'Platform Engineer',
          company: 'Acme',
          url: 'https://boards.greenhouse.io/acme/jobs/1',
        }),
        job('tailored', {
          id: 'history',
          role: 'Frontend Engineer',
          company: 'Beta',
          url: 'https://boards.greenhouse.io/beta/jobs/2',
        }),
        job('applied', {
          id: 'previous-beta',
          role: 'Backend Engineer',
          company: 'Beta',
          url: 'https://boards.greenhouse.io/beta/jobs/3',
        }),
      ],
      queue: [queueEntry('low-fit'), queueEntry('history')],
      fitScores: { 'low-fit': 64, history: 82 },
      profileAnswers: requiredSafetyAnswers,
    });

    expect(screen.getByText('Queue safety')).toBeDefined();
    expect(screen.getByText('Resolve blocking warnings before guarded submit.')).toBeDefined();
    expect(screen.getByText('1 blocked')).toBeDefined();
    expect(screen.getByText('2 warnings')).toBeDefined();
    expect(screen.getByText('0 clean')).toBeDefined();
  });

  it('surfaces discovery semantic context on queued applications', () => {
    renderCommandCenter({
      jobs: [
        job('draft', {
          id: 'matched',
          role: 'AI Product Engineer',
          company: 'Beta',
          notes: 'RolePatch semantic match: 93% resume match. Evidence: RAG, Semantic.',
        }),
      ],
      queue: [queueEntry('matched')],
    });

    expect(screen.getByText('93% resume match')).toBeDefined();
    expect(screen.getByText('Evidence: RAG, Semantic')).toBeDefined();
  });

  it('surfaces discovery alert source context on queued applications', () => {
    renderCommandCenter({
      jobs: [
        job('draft', {
          id: 'alerted',
          role: 'Platform Engineer',
          company: 'Acme',
          notes: 'RolePatch discovery alert: greenhouse · Remote.',
        }),
      ],
      queue: [queueEntry('alerted')],
    });

    expect(screen.getByText('Discovery: greenhouse')).toBeDefined();
    expect(screen.getByText('Remote')).toBeDefined();
  });

  it('surfaces combined semantic and discovery alert context on queued applications', () => {
    renderCommandCenter({
      jobs: [
        job('draft', {
          id: 'multi-source',
          role: 'AI Platform Engineer',
          company: 'Acme',
          notes:
            'RolePatch semantic match: 93% resume match. Evidence: RAG, Semantic.\n\nRolePatch discovery alert: greenhouse · Remote.',
        }),
      ],
      queue: [queueEntry('multi-source')],
    });

    expect(screen.getByText('93% resume match')).toBeDefined();
    expect(screen.getByText('Evidence: RAG, Semantic')).toBeDefined();
    expect(screen.getByText('Discovery: greenhouse')).toBeDefined();
    expect(screen.getByText('Remote')).toBeDefined();
    expect(screen.queryByText(/RolePatch discovery alert:/)).toBeNull();
  });

  it('renders receipt transparency metrics from captured fields', () => {
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      receipts: [
        receipt({
          status: 'filled',
          confirmation_text: 'Fields filled by the RolePatch extension.',
          fields: [
            { label: 'Filled fields', value: '3', source: 'system' },
            { label: 'Skipped fields', value: '1', source: 'system' },
            {
              label: 'Files uploaded by extension',
              value: 'Resume upload: resume.pdf',
              source: 'system',
            },
            {
              label: 'Manual file uploads needed',
              value: 'Cover letter upload',
              source: 'system',
            },
            {
              label: 'Blocked reasons',
              value: 'Required fields are empty: Sponsorship',
              source: 'system',
            },
            {
              label: 'Proof candidate',
              value: 'Checkout speedup: reduced checkout latency',
              source: 'system',
            },
          ],
        }),
      ],
    });

    expect(screen.getByText('3 answered')).toBeDefined();
    expect(screen.getByText('1 skipped')).toBeDefined();
    expect(screen.getByText('1 uploaded')).toBeDefined();
    expect(screen.getByText('1 proof candidates')).toBeDefined();
    expect(screen.getByText('1 manual uploads')).toBeDefined();
    expect(screen.getByText('1 blockers')).toBeDefined();
    expect(screen.getByText('confirmation captured')).toBeDefined();
  });

  it('reveals field-level receipt details on demand', async () => {
    const user = userEvent.setup();
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      receipts: [
        receipt({
          status: 'submitted',
          confirmation_text: 'Application submitted.',
          fields: [
            {
              label: 'Authorized to work in US?',
              value: 'Yes, authorized to work in the United States.',
              source: 'profile',
            },
            {
              label: 'Resume upload',
              value: 'rolepatch-resume.pdf',
              source: 'user',
            },
          ],
        }),
      ],
    });

    expect(screen.queryByText('Captured fields')).toBeNull();

    await user.click(screen.getByText('Fields'));

    expect(screen.getByText('Captured fields')).toBeDefined();
    expect(screen.getByText('Authorized to work in US?')).toBeDefined();
    expect(screen.getByText('Yes, authorized to work in the United States.')).toBeDefined();
    expect(screen.getByText('Resume upload')).toBeDefined();
    expect(screen.getByText('rolepatch-resume.pdf')).toBeDefined();
    expect(screen.getByText('profile')).toBeDefined();
    expect(screen.getByText('user')).toBeDefined();
  });

  it('copies a portable receipt audit summary', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderCommandCenter({
      jobs: [
        job('tailored', {
          id: 'tailored',
          role: 'Frontend Engineer',
          company: 'Vercel',
          url: 'https://boards.greenhouse.io/vercel/jobs/1',
        }),
      ],
      queue: [queueEntry('tailored')],
      receipts: [
        receipt({
          status: 'submitted',
          provider: 'greenhouse',
          confirmation_text: 'Application submitted.',
          confirmation_url: 'https://boards.greenhouse.io/vercel/jobs/1/confirmation',
          fields: [
            {
              label: 'Authorized to work in US?',
              value: 'Yes, authorized to work in the United States.',
              source: 'profile',
            },
          ],
        }),
      ],
    });

    await user.click(screen.getByText('Copy receipt'));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('RolePatch application receipt')
    );
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Role: Frontend Engineer'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Company: Vercel'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Provider: greenhouse'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Application submitted.'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(
        '- Authorized to work in US? [profile]: Yes, authorized to work in the United States.'
      )
    );
    expect(screen.getByText('Copied receipt')).toBeDefined();
  });

  it('renders a newest-first receipt timeline for repeated attempts', () => {
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      receipts: [
        receipt({
          id: 'receipt-new',
          status: 'submitted',
          provider: 'greenhouse',
          confirmation_text: 'Application submitted.',
          created_at: 1_720_000_300,
          fields: [
            { label: 'Filled fields', value: '4', source: 'system' },
            { label: 'Blocked reasons', value: 'None', source: 'system' },
          ],
        }),
        receipt({
          id: 'receipt-old',
          status: 'failed',
          provider: 'greenhouse',
          confirmation_text: 'Guarded submit blocked.',
          created_at: 1_720_000_000,
          fields: [
            { label: 'Filled fields', value: '2', source: 'system' },
            {
              label: 'Blocked reasons',
              value: 'Required fields are empty: Sponsorship',
              source: 'system',
            },
          ],
        }),
      ],
    });

    expect(screen.getByText('Receipt timeline')).toBeDefined();
    const submitted = screen.getByText('submitted · greenhouse');
    const failed = screen.getByText('failed · greenhouse');
    expect(
      submitted.compareDocumentPosition(failed) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText(/4 answered · 0 blockers/i)).toBeDefined();
    expect(screen.getByText(/2 answered · 1 blockers/i)).toBeDefined();
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
    expect(screen.getByText(/50% success · 50% blocked/i)).toBeDefined();
    expect(screen.getByText(/1 submitted · 1 blocked · 2 total/i)).toBeDefined();
    expect(screen.getByText(/Collect more receipts/i)).toBeDefined();
    expect(screen.getByText(/missing required fields · lever/i)).toBeDefined();
  });

  it('recommends deeper provider automation only after enough clean receipts', () => {
    renderCommandCenter({
      receipts: Array.from({ length: 5 }, (_, index) =>
        receipt({
          id: `receipt-${index}`,
          job_id: `job-${index}`,
          queue_id: `queue-${index}`,
          provider: 'smartrecruiters',
          status: index < 4 ? 'submitted' : 'filled',
          confirmation_text:
            index < 4 ? 'Guarded submit completed.' : 'Fields filled by RolePatch.',
          confirmation_url:
            index < 4 ? `https://jobs.smartrecruiters.com/acme/thanks-${index}` : null,
          fields: [
            {
              label: 'Browser runner mode',
              value: index < 4 ? 'Guarded browser submit' : 'Reviewed browser check',
              source: 'system',
            },
            { label: 'Failure code', value: 'none', source: 'system' },
          ],
        })
      ),
    });

    expect(screen.getByText(/80% success · 0% blocked/i)).toBeDefined();
    expect(screen.getByText(/4 submitted · 0 blocked · 5 total/i)).toBeDefined();
    expect(screen.getByText(/Ready for deeper automation/i)).toBeDefined();
    expect(
      screen.getByText(/smartrecruiters has candidate evidence for deeper design/i)
    ).toBeDefined();
    expect(screen.getByText(/unattended apply stays locked/i)).toBeDefined();
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

  it('turns missing required browser fields into profile-answer prompts', async () => {
    const user = userEvent.setup();
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'failed' })],
      receipts: [receipt()],
    });

    expect(screen.getByText('Missing answer prompts')).toBeDefined();
    expect(screen.getByText('Work authorization')).toBeDefined();
    expect(screen.getAllByText('Sponsorship').length).toBeGreaterThan(0);

    await user.click(screen.getAllByText('Use prompt')[0]);

    expect(screen.getByDisplayValue('Work authorization')).toBeDefined();
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
    expect(screen.getByText('Answer bank review')).toBeDefined();
    expect(screen.getByText('1/4 covered')).toBeDefined();
    expect(screen.getByText('Missing coverage')).toBeDefined();
    expect(screen.getAllByText(/review required/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Authorized to work in US?')).toBeDefined();
    expect(screen.getByText(/authorized to work in the United States/i)).toBeDefined();
    expect(screen.getAllByText(/Work auth/i).length).toBeGreaterThan(0);
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

  it('queues actionable discovery alerts in one reviewed batch', async () => {
    const user = userEvent.setup();
    const onQueueDiscoveryAlerts = vi.fn(async () => {});
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
        {
          id: 'alert-2',
          alert_type: 'company_watch',
          title: 'AI Engineer',
          detail: 'Beta · New York',
          company: 'Beta',
          job_url: 'https://jobs.lever.co/beta/2',
          location: 'New York',
          source: 'lever',
          seen: 1,
          created_at: 1_720_000_100,
        },
      ],
      onQueueDiscoveryAlerts,
    });

    await user.click(screen.getByText('Queue 2 alerts'));

    expect(onQueueDiscoveryAlerts).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'alert-1' }),
      expect.objectContaining({ id: 'alert-2' }),
    ]);
  });

  it('does not batch queue discovery alerts that are already queued', () => {
    renderCommandCenter({
      jobs: [
        job('draft', {
          id: 'already-queued',
          url: 'https://boards.greenhouse.io/acme/jobs/1?utm=rolepatch',
        }),
      ],
      queue: [queueEntry('already-queued')],
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
    });

    expect(screen.getByText('Alerts queued')).toBeDisabled();
    expect(
      screen
        .getAllByRole('button', { name: 'Queued' })
        .every((button) => (button as HTMLButtonElement).disabled)
    ).toBe(true);
  });

  it('renders queue filters and prepared packet', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored')],
      packets: [
        {
          job_id: 'tailored',
          ats_url: 'https://boards.greenhouse.io/vercel/jobs/1',
          ats_provider: 'greenhouse',
          resume_id: 'resume-1',
          resume_name: 'Base resume',
          tailored_resume_id: 'tailored-1',
          tailored_excerpt: 'Tailored resume excerpt',
          cover_letter_id: null,
          cover_letter_excerpt: null,
          profile_answers: [],
          proof_items: [
            {
              id: 'proof-1',
              title: 'Checkout speedup',
              claim: 'Led checkout performance work, reduced latency (42% across 3 markets)',
              readiness: 'Proof-ready',
              missing: [],
              tags: ['performance'],
              source_url: 'https://github.com/acme/checkout',
            },
          ],
          receipt: null,
        } satisfies ApplicationPacket,
      ],
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
    expect(screen.getByText('Optional proof points')).toBeDefined();
    expect(screen.getByText('Checkout speedup')).toBeDefined();
    expect(screen.getByText('User-provided')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://github.com/acme/checkout'
    );

    await user.click(screen.getByText('Copy proof packet'));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('RolePatch proof packet'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Role: Frontend Engineer'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Company: Vercel'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('RolePatch does not automatically share them with employers')
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(
        '- Checkout speedup [Proof-ready]: Led checkout performance work, reduced latency (42% across 3 markets)'
      )
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('Source: https://github.com/acme/checkout')
    );
    expect(screen.getByText('Copied proof')).toBeDefined();
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
      profileAnswers: requiredSafetyAnswers,
      onRunGuardedSubmit,
    });

    await user.click(screen.getAllByRole('button', { name: 'Guarded submit' }).at(-1)!);

    expect(onRunGuardedSubmit).toHaveBeenCalledWith('queue-tailored');
  });

  it('blocks guarded submit when the daily cap is reached', async () => {
    const user = userEvent.setup();
    const onRunGuardedSubmit = vi.fn(async () => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    confirmSpy.mockClear();
    const now = Math.floor(Date.now() / 1000);
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      profileAnswers: [
        ...requiredSafetyAnswers,
        {
          id: 'profile-daily-cap',
          category: 'other',
          label: 'Daily guarded submit cap',
          answer: '1',
          sensitive: 1,
          created_at: now,
          updated_at: now,
        },
      ],
      receipts: [guardedSubmitReceipt({ id: 'receipt-today', created_at: now })],
      onRunGuardedSubmit,
    });

    expect(screen.getByText('1/1 guarded submits used today; 0 remaining.')).toBeDefined();
    await user.click(screen.getAllByRole('button', { name: 'Guarded submit' }).at(-1)!);

    expect(screen.getByText(/Daily guarded submit cap reached \(1\/1\)/i)).toBeDefined();
    expect(onRunGuardedSubmit).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('trims batch guarded submit to the remaining daily allowance', async () => {
    const user = userEvent.setup();
    const onRunGuardedSubmitBatch = vi.fn(async () => {});
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    const now = Math.floor(Date.now() / 1000);
    renderCommandCenter({
      jobs: [
        job('tailored', {
          id: 'tailored-1',
          role: 'Frontend Engineer',
          company: 'Vercel',
          url: 'https://boards.greenhouse.io/vercel/jobs/1',
        }),
        job('tailored', {
          id: 'tailored-2',
          role: 'Backend Engineer',
          company: 'Stripe',
          url: 'https://jobs.lever.co/stripe/2',
        }),
      ],
      queue: [
        queueEntry('tailored-1', { status: 'ready_to_submit' }),
        queueEntry('tailored-2', { status: 'ready_to_submit' }),
      ],
      profileAnswers: [
        ...requiredSafetyAnswers,
        {
          id: 'profile-daily-cap',
          category: 'other',
          label: 'Daily guarded submit cap',
          answer: '2',
          sensitive: 1,
          created_at: now,
          updated_at: now,
        },
      ],
      receipts: [guardedSubmitReceipt({ id: 'receipt-today', created_at: now })],
      onRunGuardedSubmitBatch,
    });

    await user.click(screen.getByText('Select visible'));
    await user.click(screen.getAllByRole('button', { name: 'Guarded submit' })[0]);

    expect(onRunGuardedSubmitBatch).toHaveBeenCalledWith(['queue-tailored-1']);
  });

  it('updates an existing daily guarded submit cap from safety preferences', async () => {
    const user = userEvent.setup();
    const onSaveProfileAnswer = vi.fn(async () => {});
    renderCommandCenter({
      profileAnswers: [
        ...requiredSafetyAnswers,
        {
          id: 'profile-daily-cap',
          category: 'other',
          label: 'Daily guarded submit cap',
          answer: '4',
          sensitive: 1,
          created_at: 1_720_000_000,
          updated_at: 1_720_000_000,
        },
      ],
      onSaveProfileAnswer,
    });

    await user.click(screen.getByText('Edit cap'));

    const answerInput = screen.getByDisplayValue('4');
    await user.clear(answerInput);
    await user.type(answerInput, '7');
    await user.click(screen.getByText('Update answer'));

    expect(onSaveProfileAnswer).toHaveBeenCalledWith({
      id: 'profile-daily-cap',
      category: 'other',
      label: 'Daily guarded submit cap',
      answer: '7',
      sensitive: true,
    });
  });

  it('surfaces excluded-company safety blockers in queued applications', () => {
    renderCommandCenter({
      jobs: [
        job('tailored', {
          id: 'tailored',
          role: 'Platform Engineer',
          company: 'Acme',
        }),
      ],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      profileAnswers: [
        ...requiredSafetyAnswers,
        {
          id: 'profile-exclusions',
          category: 'other',
          label: 'Excluded companies',
          answer: 'Acme, Example Corp',
          sensitive: 1,
          created_at: 1_720_000_000,
          updated_at: 1_720_000_000,
        },
      ],
    });

    expect(screen.getByText('Safety review')).toBeDefined();
    expect(screen.getByText('Excluded company')).toBeDefined();
    expect(screen.getByText(/Matches saved exclusion "acme"/i)).toBeDefined();
    expect(
      screen
        .getAllByRole('button', { name: 'Guarded submit' })
        .some((button) => (button as HTMLButtonElement).disabled)
    ).toBe(true);
  });

  it('prefills excluded-company safety preferences through the profile answer form', async () => {
    const user = userEvent.setup();
    renderCommandCenter();

    expect(screen.getByText('Safety preferences')).toBeDefined();
    expect(screen.getByText('Add exclusions')).toBeDefined();

    await user.click(screen.getByText('Add exclusions'));

    expect(screen.getByDisplayValue('Excluded companies')).toBeDefined();
  });

  it('updates an existing excluded-company answer from safety preferences', async () => {
    const user = userEvent.setup();
    const onSaveProfileAnswer = vi.fn(async () => {});
    renderCommandCenter({
      profileAnswers: [
        ...requiredSafetyAnswers,
        {
          id: 'profile-exclusions',
          category: 'other',
          label: 'Excluded companies',
          answer: 'Acme, Example Corp',
          sensitive: 1,
          created_at: 1_720_000_000,
          updated_at: 1_720_000_000,
        },
      ],
      onSaveProfileAnswer,
    });

    expect(screen.getByText('2 companies blocked from guarded submit.')).toBeDefined();
    await user.click(screen.getByText('Edit exclusions'));

    const answerInput = screen.getByDisplayValue('Acme, Example Corp');
    await user.clear(answerInput);
    await user.type(answerInput, 'Acme, Beta Labs');
    await user.click(screen.getByText('Update answer'));

    expect(onSaveProfileAnswer).toHaveBeenCalledWith({
      id: 'profile-exclusions',
      category: 'other',
      label: 'Excluded companies',
      answer: 'Acme, Beta Labs',
      sensitive: true,
    });
  });

  it('surfaces duplicate URL and low-confidence safety blockers', () => {
    renderCommandCenter({
      jobs: [
        job('tailored', {
          id: 'tailored',
          role: 'Platform Engineer',
          company: 'Acme',
          url: 'https://boards.greenhouse.io/acme/jobs/1?utm=rolepatch',
        }),
        job('draft', {
          id: 'duplicate',
          role: 'Backend Engineer',
          company: 'Acme',
          url: 'https://boards.greenhouse.io/acme/jobs/1',
        }),
      ],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      fitScores: { tailored: 64 },
      profileAnswers: requiredSafetyAnswers,
    });

    expect(screen.getByText('Duplicate job URL')).toBeDefined();
    expect(screen.getByText('Low fit confidence')).toBeDefined();
    expect(screen.getByText(/Fit score is 64; minimum is 70/i)).toBeDefined();
  });

  it('uses the saved minimum-fit safety threshold for low-confidence blockers', () => {
    renderCommandCenter({
      jobs: [
        job('tailored', {
          id: 'tailored',
          role: 'Platform Engineer',
          company: 'Acme',
          url: 'https://boards.greenhouse.io/acme/jobs/1',
        }),
      ],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      fitScores: { tailored: 76 },
      profileAnswers: [
        ...requiredSafetyAnswers,
        {
          id: 'profile-min-fit',
          category: 'other',
          label: 'Minimum fit score',
          answer: '80',
          sensitive: 1,
          created_at: 1_720_000_000,
          updated_at: 1_720_000_000,
        },
      ],
    });

    expect(screen.getByText('Guarded submit blocks roles below 80.')).toBeDefined();
    expect(screen.getByText('Low fit confidence')).toBeDefined();
    expect(screen.getByText(/Fit score is 76; minimum is 80/i)).toBeDefined();
  });

  it('updates an existing minimum-fit threshold from safety preferences', async () => {
    const user = userEvent.setup();
    const onSaveProfileAnswer = vi.fn(async () => {});
    renderCommandCenter({
      profileAnswers: [
        ...requiredSafetyAnswers,
        {
          id: 'profile-min-fit',
          category: 'other',
          label: 'Minimum fit score',
          answer: '75',
          sensitive: 1,
          created_at: 1_720_000_000,
          updated_at: 1_720_000_000,
        },
      ],
      onSaveProfileAnswer,
    });

    await user.click(screen.getByText('Edit threshold'));

    const answerInput = screen.getByDisplayValue('75');
    await user.clear(answerInput);
    await user.type(answerInput, '82');
    await user.click(screen.getByText('Update answer'));

    expect(onSaveProfileAnswer).toHaveBeenCalledWith({
      id: 'profile-min-fit',
      category: 'other',
      label: 'Minimum fit score',
      answer: '82',
      sensitive: true,
    });
  });

  it('blocks guarded submit when work authorization or sponsorship answers are missing', async () => {
    const user = userEvent.setup();
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      profileAnswers: [requiredSafetyAnswers[0]],
    });

    expect(screen.getByText('Required answers missing')).toBeDefined();
    expect(screen.getByText(/Add Sponsorship answers before guarded submit/i)).toBeDefined();
    expect(
      screen
        .getAllByRole('button', { name: 'Guarded submit' })
        .some((button) => (button as HTMLButtonElement).disabled)
    ).toBe(true);

    await user.click(screen.getByText('Add Sponsorship'));

    expect(screen.getByDisplayValue('Need visa sponsorship?')).toBeDefined();
  });

  it('surfaces same-company application history without blocking submit', async () => {
    const user = userEvent.setup();
    const onRunGuardedSubmit = vi.fn(async () => {});
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    renderCommandCenter({
      jobs: [
        job('tailored', {
          id: 'tailored',
          role: 'Platform Engineer',
          company: 'Acme',
          url: 'https://boards.greenhouse.io/acme/jobs/1',
        }),
        job('applied', {
          id: 'previous',
          role: 'Backend Engineer',
          company: 'Acme',
          url: 'https://boards.greenhouse.io/acme/jobs/2',
        }),
      ],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      fitScores: { tailored: 82 },
      profileAnswers: requiredSafetyAnswers,
      onRunGuardedSubmit,
    });

    expect(screen.getByText('Company history')).toBeDefined();
    expect(
      screen.getByText(/Already tracking 1 submitted-stage role at this company/i)
    ).toBeDefined();

    await user.click(screen.getAllByText('Guarded submit').at(-1)!);

    expect(onRunGuardedSubmit).toHaveBeenCalledWith('queue-tailored');
  });

  it('runs guarded submit for selected ready queue entries after confirmation', async () => {
    const user = userEvent.setup();
    const onRunGuardedSubmitBatch = vi.fn(async () => {});
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      profileAnswers: requiredSafetyAnswers,
      onRunGuardedSubmitBatch,
    });

    await user.click(screen.getByText('Select visible'));
    await user.click(screen.getAllByRole('button', { name: 'Guarded submit' })[0]);

    expect(onRunGuardedSubmitBatch).toHaveBeenCalledWith(['queue-tailored']);
  });

  it('blocks batch guarded submit when selected entries need safety review', async () => {
    const user = userEvent.setup();
    const onRunGuardedSubmitBatch = vi.fn(async () => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
    confirmSpy.mockClear();
    renderCommandCenter({
      jobs: [job('tailored', { id: 'tailored', role: 'Frontend Engineer', company: 'Vercel' })],
      queue: [queueEntry('tailored', { status: 'ready_to_submit' })],
      fitScores: { tailored: 55 },
      onRunGuardedSubmitBatch,
    });

    await user.click(screen.getByText('Select visible'));
    await user.click(screen.getAllByRole('button', { name: 'Guarded submit' })[0]);

    expect(screen.getByText(/Resolve safety review on 1 selected entry/i)).toBeDefined();
    expect(onRunGuardedSubmitBatch).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
