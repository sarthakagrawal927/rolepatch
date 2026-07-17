import type { Metadata } from 'next';

import { ToolSeo } from '@/components/tool-seo';

export const metadata: Metadata = {
  title: 'Free Bullet Strength Checker — Grade Resume Bullets Instantly',
  description:
    'Free bullet strength checker. Paste resume bullets one per line to grade verb strength, quantified outcomes, length, tense, and first-person leakage. Runs in your browser, no sign-up.',
  alternates: { canonical: 'https://rolepatch.com/tools/bullet-check' },
};

const faqs = [
  {
    question: 'What does each bullet get graded on?',
    answer:
      'Five checks: (1) starts with a strong action verb from a curated list (shipped, led, built, architected…) and not a weak verb (did, helped, responsible…); (2) contains a quantified outcome — a percentage, dollar figure, or number; (3) length is within 6–24 words; (4) no first-person pronouns (I, me, my); (5) uses past tense rather than an -ing present participle. The bullet score is the percentage of checks that pass.',
  },
  {
    question: 'How is the overall average score calculated?',
    answer:
      'Each bullet is scored 0–100 as the share of its five checks that pass. The header shows the average across every bullet you paste, so a block of four bullets where three pass all checks reads as a high average.',
  },
  {
    question: 'Why does it flag "managed" as a weak verb?',
    answer:
      '"Managed" is ambiguous — it can mean people, projects, or just oversight. The checker flags it for review so you can swap in a more specific verb like "led", "scaled", or "drove" when the bullet supports it.',
  },
  {
    question: 'Does the checker send my bullets anywhere?',
    answer:
      'No. The analysis runs entirely in your browser. There is no upload, no account, and no network call — paste and read the grades inline.',
  },
  {
    question: 'What is the ideal bullet length?',
    answer:
      'The checker flags bullets under 6 words as too short (add context) and over 24 words as too long (trim filler). The 6–24 word range is the sweet spot that carries a verb, an outcome, and a metric without becoming a paragraph.',
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToolSeo
        howItWorks={
          <>
            <p>
              Paste your resume bullets one per line and each line is graded independently on five
              checks, all running in your browser. The checker looks at the first word and compares
              it against a curated strong-verb list (shipped, led, built, architected, designed,
              scaled, reduced&hellip;) and a weak-verb set (did, made, helped, responsible,
              was&hellip;).
            </p>
            <p>
              It then checks for a quantified outcome using a regex that catches percentages, dollar
              figures, and bare numbers; verifies the bullet is 6&ndash;24 words long; flags any
              first-person pronouns (I, me, my); and warns if the opening verb is an -ing present
              participle instead of past tense. Each bullet gets a 0&ndash;100 score equal to the
              share of checks that pass, and the header shows the average across all bullets.
            </p>
            <p>
              This is the same quality bar RolePatch applies when its AI rewrites your bullets. In
              the full app you paste a job URL and the rewrites are scored against these checks
              before you ever accept them.
            </p>
          </>
        }
        faqs={faqs}
      />
    </>
  );
}
