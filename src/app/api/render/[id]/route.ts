import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCurrentUserId } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { markdownToHtml, renderPdf } from '@/lib/pdf';
import type { ResumeRenderConfig } from '@/lib/resume-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row {
  source: string;
  name?: string;
}

/** Parse render config from query params (all optional, fall back to defaults). */
function parseRenderConfig(sp: URLSearchParams): Partial<ResumeRenderConfig> {
  const cfg: Partial<ResumeRenderConfig> = {};
  const template = sp.get('template');
  if (template) cfg.template = template as ResumeRenderConfig['template'];
  const fontFamily = sp.get('fontFamily');
  if (fontFamily) cfg.fontFamily = fontFamily;
  const fontSize = sp.get('fontSize');
  if (fontSize) cfg.fontSize = Number(fontSize);
  const lineHeight = sp.get('lineHeight');
  if (lineHeight) cfg.lineHeight = Number(lineHeight);
  const margin = sp.get('margin');
  if (margin) cfg.margin = Number(margin);
  return cfg;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type');
  const format = sp.get('format') ?? 'pdf';
  const renderConfig = parseRenderConfig(sp);

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
    }
  } else {
    const res = await db.execute({
      sql: 'SELECT source, name FROM resumes WHERE id = ? AND user_id = ?',
      args: [id, userId],
    });
    const r = res.rows[0];
    if (r) {
      row = { source: String(r.source), name: String(r.name ?? 'resume') };
    }
  }

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const name = row.name ?? 'Resume';
  const slug = slugify(name);

  // TXT export — raw markdown
  if (format === 'txt') {
    return new NextResponse(row.source, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.txt"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // HTML export — standalone HTML document
  if (format === 'html') {
    const html = markdownToHtml(row.source, name, renderConfig);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.html"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // DOCX export — simple Word-compatible HTML with .doc extension
  if (format === 'docx') {
    const html = markdownToHtml(row.source, name, renderConfig);
    const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">${html
      .replace('<!DOCTYPE html>', '')
      .replace(/<html lang="en">/, '')
      .replace('</html>', '')}</html>`;
    return new NextResponse(docHtml, {
      status: 200,
      headers: {
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="${slug}.doc"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // PDF export (default)
  fileName = `${slug}.pdf`;
  const html = markdownToHtml(row.source, name, renderConfig);
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
