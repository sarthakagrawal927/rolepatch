export const dynamic = 'force-dynamic';

import { getResume } from '@/lib/actions/resume-actions';
import { ResumeEditor } from '@/components/resume-editor';

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resume = await getResume(id);

  return (
    <>
      <style>{`nav { display: none !important; }`}</style>
      <div className="h-screen flex overflow-hidden">
        <ResumeEditor
          resumeId={id}
          initialSource={resume?.source ?? null}
          resumeName={resume?.name ?? null}
        />
      </div>
    </>
  );
}
