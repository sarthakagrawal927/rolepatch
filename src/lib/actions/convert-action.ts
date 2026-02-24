'use server';

import { generateText } from 'ai';
import { getAIProvider } from '@/lib/ai';

export async function convertLatexToTypst(latexSource: string): Promise<string> {
  const { provider, model } = getAIProvider();

  const { text } = await generateText({
    model: provider(model),
    system: `You are an expert at converting LaTeX documents to Typst. Convert the given LaTeX resume to equivalent Typst markup that produces identical visual output.

Rules:
- Preserve ALL content exactly (text, bullet points, dates, links)
- Convert LaTeX commands to Typst equivalents (\\textbf → *bold*, \\textit/\\emph → _italic_, \\href → #link, \\section → = Heading, etc.)
- Convert itemize/enumerate to #list()
- Convert tabular layouts to #grid() or #table()
- Use #set page(), #set text() for document setup
- Use Typst functions (#let) for repeated patterns like resume subheadings
- Escape @ with \\@ inside content blocks
- Return ONLY the complete Typst source, no explanation or markdown fences`,
    prompt: latexSource,
  });

  return text;
}
