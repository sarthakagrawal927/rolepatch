import { describe, expect, it } from 'vitest';

import {
  buildReplyRoutingAddress,
  buildRecruiterReplyDraft,
  buildRecruiterReplyThreadKey,
  classifyRecruiterReply,
  extractReplyRoutingUserId,
  findBestRecruiterJobMatch,
  plainTextFromRawEmail,
} from '@/lib/recruiter-reply-routing';
import type { JobApplication } from '@/lib/types';

function job(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: 'job-1',
    resume_id: 'resume-1',
    url: 'https://jobs.acme.test/1',
    company: 'Acme',
    role: 'Frontend Engineer',
    jd_raw: '',
    jd_text: '',
    status: 'applied',
    interview_date: null,
    follow_up_at: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    offer_amount: null,
    notes: null,
    rejection_reason: null,
    created_at: 1,
    updated_at: 1,
    ...overrides,
  };
}

describe('recruiter reply routing', () => {
  it('builds and decodes reply routing addresses', () => {
    const address = buildReplyRoutingAddress('user_123-abc');
    expect(address).toMatch(/^reply\+.+@rolepatch\.com$/);
    expect(extractReplyRoutingUserId(address)).toBe('user_123-abc');
  });

  it('classifies interview, offer, rejection, and neutral replies', () => {
    expect(
      classifyRecruiterReply({ subject: 'Next round', text: 'Can you schedule an interview?' })
        .status
    ).toBe('interview');
    expect(
      classifyRecruiterReply({ subject: 'Offer letter', text: 'Congratulations' }).status
    ).toBe('offer');
    expect(
      classifyRecruiterReply({ subject: 'Update', text: 'Unfortunately we are not moving forward' })
        .status
    ).toBe('rejected');
    expect(classifyRecruiterReply({ subject: 'Hello', text: 'Thanks for applying' }).status).toBe(
      null
    );
  });

  it('matches a recruiter reply to a tracked application conservatively', () => {
    const match = findBestRecruiterJobMatch(
      {
        from: 'recruiter@acme.test',
        subject: 'Frontend Engineer interview',
        text: 'Acme would like to schedule time.',
      },
      [job(), job({ id: 'job-2', company: 'Beta', role: 'Backend Engineer' })]
    );
    expect(match?.job.id).toBe('job-1');
    expect(match?.score).toBeGreaterThanOrEqual(5);

    expect(
      findBestRecruiterJobMatch(
        { from: 'person@gmail.com', subject: 'quick note', text: 'hello' },
        [job()]
      )
    ).toBeNull();
  });

  it('extracts readable text from a simple raw email body', () => {
    expect(
      plainTextFromRawEmail('Subject: Hi\r\nContent-Type: text/plain\r\n\r\nHello=\r\n world')
    ).toContain('Hello world');
  });

  it('builds stable thread keys and conservative reply drafts', () => {
    expect(
      buildRecruiterReplyThreadKey({
        from: 'recruiter@acme.test',
        subject: 'Re: Frontend Engineer interview',
        message_id: 'msg-2',
        in_reply_to: 'msg-1',
      })
    ).toBe('reply:msg-1');

    const draft = buildRecruiterReplyDraft({
      classification: 'interview',
      subject: 'Frontend Engineer interview',
      from: 'recruiter@acme.test',
      job: { company: 'Acme', role: 'Frontend Engineer' },
    });
    expect(draft.subject).toBe('Re: Frontend Engineer interview');
    expect(draft.body).toContain('Frontend Engineer');
    expect(draft.body).toContain('Acme');
    expect(draft.body).not.toContain('I am available tomorrow');
  });
});
