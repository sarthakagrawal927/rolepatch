import { beforeEach, describe, expect, it } from 'vitest';

import {
  localGetFitScore,
  localGetInterviewStories,
  localListFitScores,
  localListJobs,
  localSaveFitScore,
  localSaveInterviewStories,
  localSaveJob,
  localUpdateJobStatus,
} from '@/lib/local-storage';
import type { FitScore, InterviewStory } from '@/lib/types';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
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
  dimensions: [
    { name: 'Role Alignment', score: 90, weight: 25, detail: 'Great match.' },
  ],
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
    expect(retrieved!.overall_score).toBe(82);
  });

  it('returns null for missing job', () => {
    expect(localGetFitScore('nonexistent')).toBeNull();
  });

  it('replaces fit score for same job', () => {
    localSaveFitScore(mockFitScore);
    localSaveFitScore({ ...mockFitScore, id: 'fs-2', overall_score: 95 });
    const retrieved = localGetFitScore('job-1');
    expect(retrieved!.overall_score).toBe(95);
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
