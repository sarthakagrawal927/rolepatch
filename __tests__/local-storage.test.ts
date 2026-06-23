import { beforeEach, describe, expect, it } from 'vitest';

import {
  localCreateResume,
  localCreateStashEntry,
  localDeleteResume,
  localDeleteStashEntry,
  localGetResume,
  localListResumes,
  localListStashEntries,
  localUpdateResume,
  localUpdateStashEntry,
} from '@/lib/local-storage';

describe('local-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // --- Resumes ---

  describe('resumes', () => {
    it('creates a resume and returns its id', () => {
      const id = localCreateResume('My Resume', '\\documentclass{article}');
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('lists resumes sorted by updated_at descending', () => {
      const id1 = localCreateResume('First', 'source1');
      // Update second resume so it has a strictly later timestamp
      const id2 = localCreateResume('Second', 'source2');

      // Force different timestamps by mutating storage directly
      const raw = JSON.parse(localStorage.getItem('rt-resumes')!);
      raw[0].updated_at = 1000;
      raw[1].updated_at = 2000;
      localStorage.setItem('rt-resumes', JSON.stringify(raw));

      const list = localListResumes();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(id2); // updated_at 2000 comes first
      expect(list[1].id).toBe(id1); // updated_at 1000 comes second
    });

    it('gets a resume by id', () => {
      const id = localCreateResume('Test', 'content');
      const resume = localGetResume(id);
      expect(resume).not.toBeNull();
      expect(resume?.name).toBe('Test');
      expect(resume?.source).toBe('content');
    });

    it('returns null for non-existent resume', () => {
      expect(localGetResume('non-existent')).toBeNull();
    });

    it('updates a resume source and updated_at', () => {
      const id = localCreateResume('Test', 'old content');
      const before = localGetResume(id)!;

      localUpdateResume(id, 'new content');
      const after = localGetResume(id)!;

      expect(after.source).toBe('new content');
      expect(after.updated_at).toBeGreaterThanOrEqual(before.updated_at);
    });

    it('does nothing when updating non-existent resume', () => {
      localCreateResume('Test', 'content');
      localUpdateResume('non-existent', 'new content');
      expect(localListResumes()).toHaveLength(1);
    });

    it('deletes a resume by id', () => {
      const id = localCreateResume('Test', 'content');
      expect(localListResumes()).toHaveLength(1);

      localDeleteResume(id);
      expect(localListResumes()).toHaveLength(0);
    });

    it('does nothing when deleting non-existent resume', () => {
      localCreateResume('Test', 'content');
      localDeleteResume('non-existent');
      expect(localListResumes()).toHaveLength(1);
    });
  });

  // --- Stash Entries ---

  describe('stash entries', () => {
    it('creates a stash entry and returns its id', () => {
      const id = localCreateStashEntry('skills', 'Python', 'Expert in Python');
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('lists stash entries sorted by updated_at descending', () => {
      const id1 = localCreateStashEntry('skills', 'Python', 'content1');
      const id2 = localCreateStashEntry('projects', 'Web App', 'content2');

      // Force different timestamps to ensure deterministic sort
      const raw = JSON.parse(localStorage.getItem('rt-stash')!);
      raw[0].updated_at = 1000;
      raw[1].updated_at = 2000;
      localStorage.setItem('rt-stash', JSON.stringify(raw));

      const list = localListStashEntries();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(id2); // updated_at 2000 comes first
      expect(list[1].id).toBe(id1); // updated_at 1000 comes second
    });

    it('updates a stash entry', () => {
      const id = localCreateStashEntry('skills', 'Python', 'old content');

      localUpdateStashEntry(id, 'languages', 'TypeScript', 'new content');
      const list = localListStashEntries();
      const entry = list.find((e) => e.id === id)!;

      expect(entry.category).toBe('languages');
      expect(entry.label).toBe('TypeScript');
      expect(entry.content).toBe('new content');
    });

    it('does nothing when updating non-existent stash entry', () => {
      localCreateStashEntry('skills', 'Python', 'content');
      localUpdateStashEntry('non-existent', 'cat', 'lab', 'con');
      expect(localListStashEntries()).toHaveLength(1);
    });

    it('deletes a stash entry by id', () => {
      const id = localCreateStashEntry('skills', 'Python', 'content');
      expect(localListStashEntries()).toHaveLength(1);

      localDeleteStashEntry(id);
      expect(localListStashEntries()).toHaveLength(0);
    });

    it('does nothing when deleting non-existent stash entry', () => {
      localCreateStashEntry('skills', 'Python', 'content');
      localDeleteStashEntry('non-existent');
      expect(localListStashEntries()).toHaveLength(1);
    });
  });

  // --- SSR Safety ---

  describe('SSR safety', () => {
    it('returns empty array when window is undefined', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating SSR by removing window
      delete globalThis.window;

      expect(localListResumes()).toEqual([]);
      expect(localListStashEntries()).toEqual([]);

      // Restore window
      globalThis.window = originalWindow;
    });
  });
});
