import type { ReactNode } from 'react';

interface FAQ {
  question: string;
  answer: string;
}

interface ToolSeoProps {
  /** 2-3 short paragraphs describing what the tool actually does. */
  howItWorks: ReactNode;
  /** 3-5 real FAQs anchored to the tool's behaviour. */
  faqs: FAQ[];
}

/**
 * Server-rendered SEO block for free tool pages: renders the how-it-works
 * prose and an FAQ list, plus a FAQPage JSON-LD script so the FAQs are
 * eligible for rich results. Kept in a server component so the markup and
 * structured data are present in the initial HTML (the tool UI itself is a
 * client component).
 */
export function ToolSeo({ howItWorks, faqs }: ToolSeoProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 prose-tool">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 className="font-serif text-2xl font-bold text-foreground mb-4">How it works</h2>
      <div className="space-y-4 text-sm leading-relaxed text-[var(--muted-foreground)]">
        {howItWorks}
      </div>
      <h2 className="font-serif text-2xl font-bold text-foreground mt-12 mb-4">
        Frequently asked questions
      </h2>
      <div className="space-y-6">
        {faqs.map((f) => (
          <div key={f.question}>
            <h3 className="text-base font-semibold text-foreground mb-1">{f.question}</h3>
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">{f.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
