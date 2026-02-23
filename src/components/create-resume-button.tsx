'use client';

import { useRouter } from 'next/navigation';
import { createResume } from '@/lib/actions/resume-actions';

export function CreateResumeButton() {
  const router = useRouter();

  async function handleCreate() {
    const name = prompt('Resume name:');
    if (!name) return;
    const id = await createResume(name);
    router.push(`/editor/${id}`);
  }

  return (
    <button
      onClick={handleCreate}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      New Resume
    </button>
  );
}
