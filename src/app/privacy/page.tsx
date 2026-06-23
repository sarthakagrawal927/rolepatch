import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: 'https://rolepatch.com/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Privacy Policy</h1>
      <div className="space-y-6 text-sm text-[var(--muted-foreground)] leading-relaxed">
        <p className="text-foreground">Last updated: March 16, 2026</p>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">What We Collect</h2>
          <p>When you use RolePatch, we process the following data:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>
              <strong className="text-foreground">Account data:</strong> Email address and name (via
              Google Sign-In)
            </li>
            <li>
              <strong className="text-foreground">Resume content:</strong> The text you paste or
              type into the editor
            </li>
            <li>
              <strong className="text-foreground">Job descriptions:</strong> URLs and text you
              provide for tailoring
            </li>
            <li>
              <strong className="text-foreground">Payment data:</strong> Processed by Dodo Payments
              — we never see your card details
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">How We Use It</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              Resume and job description text is sent to Google Gemini API to generate tailored
              versions
            </li>
            <li>We store your resumes and tailored versions so you can access them later</li>
            <li>We do not sell, share, or use your data for advertising</li>
            <li>We do not train AI models on your data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Guest Mode</h2>
          <p>
            You can use RolePatch without creating an account. In guest mode, your data is stored in
            your browser&apos;s localStorage and never sent to our servers (except for AI
            generation, which is stateless).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Data Storage</h2>
          <p>
            Your data is stored in Turso (distributed SQLite) with encryption at rest. We use Vercel
            for hosting with edge-level TLS encryption.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Data Deletion</h2>
          <p>
            You can delete your resumes, job applications, and account at any time. To request full
            data deletion, contact us at the email below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Third Parties</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              <strong className="text-foreground">Google Gemini:</strong> Processes resume/JD text
              for AI tailoring
            </li>
            <li>
              <strong className="text-foreground">Dodo Payments:</strong> Handles payment processing
            </li>
            <li>
              <strong className="text-foreground">Google Auth:</strong> Handles sign-in
            </li>
            <li>
              <strong className="text-foreground">Vercel:</strong> Hosting and edge delivery
            </li>
            <li>
              <strong className="text-foreground">Turso:</strong> Database
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
          <p>
            Questions about privacy? Email{' '}
            <strong className="text-foreground">privacy@rolepatch.com</strong>
          </p>
        </section>
      </div>
    </main>
  );
}
