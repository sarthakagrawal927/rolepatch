import { beforeEach, describe, expect, it } from 'vitest';

import {
  localGetFitScore,
  localGetJob,
  localGetInterviewStories,
  localListApplicationQueue,
  localListApplicationPackets,
  localListApplicationReceipts,
  localListFitScores,
  localListJobs,
  localListProfileAnswers,
  localQueueApplication,
  localCreateAchievementEvidence,
  localRecordManualApplicationReceipt,
  localRetryApplicationQueueEntry,
  localSaveCoverLetter,
  localSaveFitScore,
  localSaveInterviewStories,
  localSaveJob,
  localSaveProfileAnswer,
  localSaveTailoredResume,
  localUpdateJobStatus,
} from '@/lib/local-storage';
import type { FitScore, InterviewStory } from '@/lib/types';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
});

const mockFitScore: FitScore = {
  id: 'fs-1',
  job_id: 'job-1',
  overall_score: 82,
  dimensions: [{ name: 'Role Alignment', score: 90, weight: 25, detail: 'Great match.' }],
  strengths: ['Strong backend'],
  gaps: ['No cloud certs'],
  recommendation: 'Apply with confidence.',
  created_at: 1712000000,
};

const mockStories: InterviewStory[] = [
  {
    id: 'story-1',
    job_id: 'job-1',
    theme: 'Leadership',
    jd_requirement: 'Lead teams',
    situation: 'Context',
    task: 'Task',
    action: 'Action',
    result: 'Result',
    reflection: 'Reflection',
    best_for: ['leadership'],
    created_at: 1712000000,
  },
];

describe('localFitScores', () => {
  it('saves and retrieves a fit score', () => {
    localSaveFitScore(mockFitScore);
    const retrieved = localGetFitScore('job-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.overall_score).toBe(82);
  });

  it('returns null for missing job', () => {
    expect(localGetFitScore('nonexistent')).toBeNull();
  });

  it('replaces fit score for same job', () => {
    localSaveFitScore(mockFitScore);
    localSaveFitScore({ ...mockFitScore, id: 'fs-2', overall_score: 95 });
    const retrieved = localGetFitScore('job-1');
    expect(retrieved?.overall_score).toBe(95);
  });

  it('lists all fit scores as job_id -> score map', () => {
    localSaveFitScore(mockFitScore);
    localSaveFitScore({ ...mockFitScore, id: 'fs-2', job_id: 'job-2', overall_score: 60 });
    const scores = localListFitScores();
    expect(scores['job-1']).toBe(82);
    expect(scores['job-2']).toBe(60);
  });
});

describe('localInterviewStories', () => {
  it('saves and retrieves stories for a job', () => {
    localSaveInterviewStories(mockStories);
    const retrieved = localGetInterviewStories('job-1');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].theme).toBe('Leadership');
  });

  it('returns empty array for missing job', () => {
    expect(localGetInterviewStories('nonexistent')).toHaveLength(0);
  });

  it('replaces stories for same job', () => {
    localSaveInterviewStories(mockStories);
    localSaveInterviewStories([
      { ...mockStories[0], id: 'story-2', theme: 'New Theme' },
      { ...mockStories[0], id: 'story-3', theme: 'Another Theme' },
    ]);
    const retrieved = localGetInterviewStories('job-1');
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].theme).toBe('New Theme');
  });

  it('preserves stories for other jobs when saving a mixed batch', () => {
    localSaveInterviewStories([
      mockStories[0],
      { ...mockStories[0], id: 'story-2', job_id: 'job-2', theme: 'Ownership' },
    ]);

    localSaveInterviewStories([
      { ...mockStories[0], id: 'story-3', job_id: 'job-1', theme: 'Leadership v2' },
    ]);

    expect(localGetInterviewStories('job-1')).toHaveLength(1);
    expect(localGetInterviewStories('job-1')[0].theme).toBe('Leadership v2');
    expect(localGetInterviewStories('job-2')).toHaveLength(1);
    expect(localGetInterviewStories('job-2')[0].theme).toBe('Ownership');
  });
});

describe('localJobs', () => {
  it('preserves updated_at for guest job summaries', () => {
    localSaveJob('job-1', 'Acme', 'Engineer', 'resume-1');
    localUpdateJobStatus('job-1', 'applied');

    const [job] = localListJobs();
    expect(job.updated_at).toBeGreaterThanOrEqual(job.created_at);
    expect(job.status).toBe('applied');
  });
});

describe('localProfileAnswers', () => {
  it('updates an existing answer when an id is supplied', () => {
    const original = localSaveProfileAnswer({
      category: 'other',
      label: 'Excluded companies',
      answer: 'Acme',
      sensitive: true,
    });

    const updated = localSaveProfileAnswer({
      id: original.id,
      category: 'other',
      label: 'Excluded companies',
      answer: 'Acme, Beta Labs',
      sensitive: true,
    });

    expect(updated.id).toBe(original.id);
    expect(updated.created_at).toBe(original.created_at);
    expect(updated.answer).toBe('Acme, Beta Labs');
    expect(localListProfileAnswers()).toHaveLength(1);
  });
});

describe('localApplyAgentGuestFlow', () => {
  it('queues a guest job with material readiness and records a manual receipt', () => {
    localSaveJob(
      'job-1',
      'Acme',
      'Frontend Engineer',
      'resume-1',
      'https://jobs.lever.co/acme/123',
      'raw JD',
      'Own checkout performance and client-side latency.'
    );
    localSaveTailoredResume('job-1', 'resume-1', 'Tailored resume');
    const coverLetterId = localSaveCoverLetter('job-1', 'resume-1', 'Cover letter', 'Research');
    localSaveProfileAnswer({
      category: 'work_authorization',
      label: 'Work authorization',
      answer: 'Authorized to work in the United States.',
      sensitive: true,
    });
    localCreateAchievementEvidence({
      title: 'Checkout speedup',
      situation: 'Slow checkout. Source: https://github.com/acme/checkout',
      action: 'Led checkout performance work',
      result: 'reduced checkout latency',
      metric: '42%',
      scope: '3 markets',
      skills: ['performance'],
      role_targets: ['frontend'],
      impact_type: 'speed',
    });
    localCreateAchievementEvidence({
      title: 'Platform migration',
      situation: 'Legacy cluster',
      action: 'Led platform migration',
      result: 'improved deploy reliability',
      metric: '35%',
      scope: '12 services',
      skills: ['kubernetes'],
      role_targets: ['platform'],
      impact_type: 'technical',
    });

    const queued = localQueueApplication('job-1');

    expect(queued.readiness.status).toBe('ready_for_review');
    expect(queued.readiness.checks).toMatchObject({
      resume: true,
      tailored_resume: true,
      cover_letter: true,
      profile_answers: true,
      receipt: false,
    });

    const receipt = localRecordManualApplicationReceipt(queued.id);

    expect(receipt).toMatchObject({
      job_id: 'job-1',
      queue_id: queued.id,
      provider: 'lever',
      status: 'submitted',
      resume_id: 'resume-1',
      cover_letter_id: coverLetterId,
      confirmation_text: 'Marked submitted manually in RolePatch.',
    });
    expect(receipt?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Work authorization',
          value: 'Authorized to work in the United States.',
          source: 'profile',
        }),
        expect.objectContaining({
          label: 'Proof review boundary',
          source: 'system',
        }),
        expect.objectContaining({
          label: 'Proof candidate',
          value: expect.stringContaining('Source: https://github.com/acme/checkout'),
          source: 'system',
        }),
      ])
    );
    expect(localGetJob('job-1')?.status).toBe('applied');
    expect(localListApplicationQueue()[0].status).toBe('submitted');
    expect(localListApplicationReceipts(['job-1'])).toHaveLength(1);
    expect(localListApplicationPackets(['job-1'])[0].proof_items).toEqual([
      expect.objectContaining({
        title: 'Checkout speedup',
        readiness: 'Proof-ready',
        source_url: 'https://github.com/acme/checkout',
        tags: ['performance', 'frontend'],
      }),
      expect.objectContaining({
        title: 'Platform migration',
        readiness: 'Proof-ready',
      }),
    ]);
  });

  it('does not retry a submitted guest queue entry', () => {
    localSaveJob('job-1', 'Acme', 'Engineer', 'resume-1', 'https://boards.greenhouse.io/acme/1');
    localSaveTailoredResume('job-1', 'resume-1', 'Tailored resume');
    localSaveCoverLetter('job-1', 'resume-1', 'Cover letter', 'Research');

    const queued = localQueueApplication('job-1');
    expect(localRecordManualApplicationReceipt(queued.id)?.status).toBe('submitted');

    expect(() => localRetryApplicationQueueEntry(queued.id)).toThrow(/submitted/i);
  });
});
