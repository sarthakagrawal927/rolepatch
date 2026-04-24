'use server';

import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai';
import { db } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import type { AIProviderConfig } from '@/lib/types';
import { getCurrentUserId } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

const STRUCTURING_SYSTEM_PROMPT = `You convert a candidate's raw resume text (from a PDF or DOCX) into a clean Markdown resume. Follow this structure exactly:

# Full Name

email | phone | city, state
[LinkedIn](url) | [GitHub](url)

---

## Experience

**Role** — _Company_ | Start – End

- Bullet using strong verbs and concrete metrics

## Education

**Degree, Major** — _School_ | Year

## Skills

**Languages:** ...
**Frameworks:** ...
**Tools:** ...

Rules:
- Keep the candidate's exact wording for bullets. Do not rewrite or improve.
- Omit sections the source does not contain. Do not fabricate.
- Preserve dates as written.
- Return ONLY the Markdown. No commentary, no fences.`;

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') return extractPdfText(buffer);
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractDocxText(buffer);
  }
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return buffer.toString('utf-8');
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}

export async function importResumeFromFile(
  formData: FormData,
  aiConfig: AIProviderConfig,
): Promise<{ id: string; source: string }> {
  const file = formData.get('file');
  const name = (formData.get('name') as string | null)?.trim() || 'Imported Resume';
  if (!(file instanceof File)) throw new Error('No file provided');
  if (file.size === 0) throw new Error('Empty file');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawText = await extractText(buffer, file.type);
  const trimmed = rawText.trim();
  if (trimmed.length < 50) {
    throw new Error('Could not extract enough text from file. Try a different format.');
  }

  const { text: markdown } = await generateText({
    model: getAIModel(aiConfig),
    system: STRUCTURING_SYSTEM_PROMPT,
    prompt: `Raw resume text:\n\n${trimmed}`,
  });

  const userId = await getCurrentUserId();
  if (!userId) {
    // Guest: let the caller store to localStorage
    return { id: '', source: markdown };
  }

  const id = uuid();
  await db.execute({
    sql: 'INSERT INTO resumes (id, name, source, user_id) VALUES (?, ?, ?, ?)',
    args: [id, name, markdown, userId],
  });
  revalidatePath('/dashboard');
  return { id, source: markdown };
}
