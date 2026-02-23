import Link from 'next/link';
import type { Resume } from '@/lib/types';

export function ResumeCard({ resume }: { resume: Resume }) {
  const updated = new Date(resume.updated_at * 1000).toLocaleDateString();
  return (
    <Link
      href={`/editor/${resume.id}`}
      className="block border rounded-lg p-4 hover:border-blue-500 transition-colors"
    >
      <h3 className="font-semibold truncate">{resume.name}</h3>
      <p className="text-sm text-gray-500 mt-1">Updated {updated}</p>
    </Link>
  );
}
