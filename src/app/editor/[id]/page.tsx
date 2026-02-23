import { getResume } from '@/lib/actions/resume-actions';
import { notFound } from 'next/navigation';
import { LatexEditor } from '@/components/latex-editor';

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resume = await getResume(id);
  if (!resume) notFound();

  return (
    <main className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <h1 className="font-semibold">{resume.name}</h1>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">Back</a>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <LatexEditor resumeId={resume.id} initialSource={resume.latex_source} />
      </div>
    </main>
  );
}
