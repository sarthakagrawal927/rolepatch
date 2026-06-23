import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  alternates: { canonical: 'https://rolepatch.com/terms' },
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Terms of Service</h1>
      <div className="space-y-6 text-sm text-[var(--muted-foreground)] leading-relaxed">
        <p className="text-foreground">Last updated: March 16, 2026</p>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Service</h2>
          <p>
            RolePatch is an AI-powered resume tailoring tool. We provide AI-generated suggestions
            for improving your resume to match job descriptions. The output is a suggestion — you
            are responsible for reviewing and approving all changes before using them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Tokens & Payments</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              Tokens are used to access AI features (resume tailoring, cover letter generation)
            </li>
            <li>
              Free features (ATS scoring, diff tool, keyword checker, editor, stash) do not require
              tokens
            </li>
            <li>Tokens do not expire</li>
            <li>Purchases are processed by Dodo Payments</li>
            <li>Refunds are available within 14 days of purchase</li>
            <li>If an AI generation fails, your token is automatically refunded</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Your Content</h2>
          <p>
            You own your resume content. We do not claim any rights to the text you input or the
            AI-generated output. You grant us a limited license to process your content solely for
            the purpose of providing the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">AI Output</h2>
          <p>
            AI-generated content is provided as-is. We do not guarantee that tailored resumes will
            result in interviews or job offers. Always review AI suggestions before submitting
            applications. Do not include false information in your resume.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Acceptable Use</h2>
          <p>
            Do not use RolePatch to generate fraudulent resumes, impersonate others, or submit
            misleading applications. We reserve the right to terminate accounts that violate these
            terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Availability</h2>
          <p>
            We aim for high availability but do not guarantee uninterrupted service. AI providers
            may experience outages. If a generation fails, your token is refunded automatically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
          <p>
            Questions? Email <strong className="text-foreground">hello@rolepatch.com</strong>
          </p>
        </section>
      </div>
    </main>
  );
}
