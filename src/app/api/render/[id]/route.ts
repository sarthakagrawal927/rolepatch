import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { markdownToHtml, renderPdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row {
  source: string;
  name?: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const type = req.nextUrl.searchParams.get('type');

  let row: Row | null = null;
  let fileName = 'resume.pdf';

  if (type === 'tailored') {
    const res = await db.execute({
      sql: 'SELECT source FROM tailored_resumes WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    const r = res.rows[0];
    if (r) {
      row = { source: String(r.source) };
      fileName = `tailored-resume-${id.slice(0, 8)}.pdf`;
    }
  } else {
    const res = await db.execute({
      sql: 'SELECT source, name FROM resumes WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    const r = res.rows[0];
    if (r) {
      row = { source: String(r.source), name: String(r.name ?? 'resume') };
      fileName = `${slugify(String(r.name ?? 'resume'))}.pdf`;
    }
  }

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const html = markdownToHtml(row.source, row.name ?? 'Resume');
  const pdf = await renderPdf(html);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'resume'
  );
}
