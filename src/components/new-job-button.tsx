'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { scrapeJobUrl } from '@/lib/actions/scrape-action';
import { createJobApplication } from '@/lib/actions/job-actions';
import type { Resume } from '@/lib/types';

interface NewJobButtonProps {
  resumes: Resume[];
}

export function NewJobButton({ resumes }: NewJobButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (resumes.length === 0) {
      alert('Create a resume first before adding a job.');
      return;
    }

    // Pick resume — if only one, use it; otherwise prompt
    let resumeId: string;
    if (resumes.length === 1) {
      resumeId = resumes[0].id;
    } else {
      const options = resumes.map((r, i) => `${i + 1}. ${r.name}`).join('\n');
      const choice = prompt(`Which resume?\n\n${options}\n\nEnter number:`);
      if (!choice) return;
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= resumes.length) {
        alert('Invalid selection.');
        return;
      }
      resumeId = resumes[idx].id;
    }

    const url = prompt('Job URL:');
    if (!url) return;

    setLoading(true);
    try {
      const scraped = await scrapeJobUrl(url);
      const jobId = await createJobApplication(
        resumeId,
        url,
        scraped.company,
        scraped.role,
        scraped.html,
        scraped.text,
      );
      router.push(`/tailor/${jobId}`);
    } catch (err) {
      alert(`Failed to scrape job: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
    >
      {loading ? 'Scraping...' : 'Add Job'}
    </button>
  );
}
