import type { Metadata } from 'next';

import { ToolSeo } from '@/components/tool-seo';

export const metadata: Metadata = {
  title: 'Free Bullet Snippet Library — Save & Reuse Resume Paragraphs',
  description:
    'Free bullet snippet library. Save reusable accomplishment bullets and cover-letter paragraphs in your browser and copy them into any resume in one click. No sign-up, no server.',
  alternates: { canonical: 'https://rolepatch.com/tools/snippets' },
};

const faqs = [
  {
    question: 'Where are my snippets stored?',
    answer:
      'Snippets are saved in your browser\'s localStorage under the key "resume-tailor-snippets". Nothing is sent to a server — the tool has no account and no backend. Clearing your browser storage will delete them, so export anything you want to keep.',
  },
  {
    question: 'Can I edit or delete a snippet?',
    answer:
      'Yes. Each snippet has edit and delete controls. Editing loads the title and body back into the form at the top; deleting removes it immediately from localStorage. A copy button copies the snippet body to your clipboard.',
  },
  {
    question: 'Do snippets sync across devices?',
    answer:
      'No. Because storage is local to this browser, snippets do not sync to other devices or browsers. If you sign in to the full RolePatch app, the stash feature persists reusable content server-side under your account.',
  },
  {
    question: 'What should I save as a snippet?',
    answer:
      'Reusable accomplishment bullets, cover-letter openers, or any paragraph you paste repeatedly. Give each a title like "Why I ship — generic open" so you can find it fast, then copy the body into a resume or cover letter in one click.',
  },
  {
    question: 'Is there a limit on how many snippets I can save?',
    answer:
      "There is no app-imposed limit. The only constraint is your browser's localStorage quota, which is typically a few megabytes — plenty for hundreds of text snippets.",
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
              Save reusable resume bullets, cover-letter paragraphs, or any text block once and copy
              it into any document later. Each snippet has a title and a body; the tool stores them
              in your browser&apos;s localStorage under the key{' '}
              <code className="rounded bg-[var(--muted)] px-1 py-0.5 text-xs">
                resume-tailor-snippets
              </code>{' '}
              &mdash; no account, no server, nothing leaves the page.
            </p>
            <p>
              The form at the top creates a new snippet or edits an existing one. Each saved snippet
              shows a copy button (writes the body to your clipboard), an edit button (loads it back
              into the form), and a delete button. New snippets are stamped with a UUID and a
              last-updated date so you can tell fresh from stale.
            </p>
            <p>
              This is the lightweight, local version of the stash feature in the full RolePatch app.
              Sign in there and your reusable content persists server-side under your account and is
              available to the AI when it tailors your resume.
            </p>
          </>
        }
        faqs={faqs}
      />
    </>
  );
}
