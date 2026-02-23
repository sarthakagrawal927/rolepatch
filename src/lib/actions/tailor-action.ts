'use server';

import { generateText } from 'ai';
import { getAIProvider } from '@/lib/ai';
import type { AIProviderConfig } from '@/lib/types';

export async function tailorResume(
  latexSource: string,
  jdText: string,
  aiConfig?: Partial<AIProviderConfig>,
): Promise<string> {
  const { provider, model } = getAIProvider(aiConfig);

  const { text } = await generateText({
    model: provider(model),
    system: `You are a resume tailoring expert. You receive a LaTeX resume and a job description. Modify the resume content to better match the job while keeping the LaTeX structure and formatting intact. Only modify content sections (summary, experience bullets, skills). Do not change the LaTeX preamble, layout commands, or formatting. Return ONLY the complete modified LaTeX source, no explanation.`,
    prompt: `## Base Resume (LaTeX):\n${latexSource}\n\n## Job Description:\n${jdText}\n\n## Instructions:\n- Emphasize relevant experience and skills that match the JD\n- Reword bullet points to use keywords from the JD where truthful\n- Reorder skills to prioritize those mentioned in the JD\n- Keep it honest — do not fabricate experience`,
  });

  return text;
}
