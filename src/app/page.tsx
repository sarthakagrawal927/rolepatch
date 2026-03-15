import Link from "next/link";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RolePatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://rolepatch.com",
  description: "AI-powered resume tailoring with transparent diff view. See exactly what changed, word by word.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "3 free tokens to start. No credit card required.",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "120",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Diff animation keyframes ── */}
      <style>{`
        @keyframes highlightFadeIn {
          0% { opacity: 0; background-color: transparent; }
          100% { opacity: 1; background-color: #0d2818; }
        }
        @keyframes badgeCountUp {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .diff-highlight {
          animation: highlightFadeIn 0.6s ease-out forwards;
          opacity: 0;
          color: #4ade80;
          background-color: transparent;
          border-radius: 3px;
          padding: 1px 4px;
        }
        .diff-badge {
          animation: badgeCountUp 0.5s ease-out 2.8s forwards;
          opacity: 0;
        }
      `}</style>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-green-500 flex items-center justify-center text-[10px] font-bold text-white">RP</span>
            <span className="font-bold text-lg tracking-tight text-white">RolePatch</span>
          </div>
          <nav className="hidden sm:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <Link href="/tools" className="hover:text-white transition-colors">Free Tools</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </nav>
          <Link
            href="/dashboard"
            className="bg-white text-gray-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {"Get started free \u2192"}
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-28 pb-20 px-6">
        {/* gradient mesh background */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-green-500/8 blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-[400px] h-[400px] rounded-full bg-emerald-400/6 blur-[100px]" />
          <div className="absolute -bottom-20 left-1/2 w-[500px] h-[300px] rounded-full bg-green-600/5 blur-[80px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 text-xs font-medium tracking-wider uppercase text-green-400 bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            AI-powered resume tailoring
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold leading-[1.05] tracking-tight">
            Your resume,{" "}
            <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-green-300 bg-clip-text text-transparent">
              tailored perfectly
            </span>{" "}
            for every job.
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Paste a job description and let AI rewrite your resume to match — in
            seconds. See exactly what changed, then apply with confidence.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/dashboard"
              className="group bg-white text-gray-900 font-semibold px-8 py-3.5 rounded-xl text-lg transition-all hover:shadow-lg hover:shadow-green-500/10 hover:-translate-y-0.5"
            >
              Start tailoring
              <span className="inline-block ml-1 transition-transform group-hover:translate-x-0.5">{"\u2192"}</span>
            </Link>
            <a
              href="#how-it-works"
              className="border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-8 py-3.5 rounded-xl text-lg transition-colors"
            >
              See how it works
            </a>
          </div>

          <p className="text-sm text-gray-600">
            3 free tokens to start. No credit card required.
          </p>
        </div>

        {/* ── Animated Diff Preview ── */}
        <div className="relative max-w-5xl mx-auto mt-20">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl shadow-black/40 overflow-hidden backdrop-blur">
            {/* browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-950/60">
              <span className="w-3 h-3 rounded-full bg-gray-700" />
              <span className="w-3 h-3 rounded-full bg-gray-700" />
              <span className="w-3 h-3 rounded-full bg-gray-700" />
              <span className="ml-3 flex-1 text-xs text-center text-gray-500 bg-gray-800/50 rounded px-4 py-1">
                rolepatch.com/tailor
              </span>
            </div>
            {/* diff content */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-800 min-h-[280px]">
              {/* left: original */}
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Original</p>
                <div className="space-y-3 text-sm font-mono leading-relaxed text-gray-500">
                  <p>{"\u2022"} Led development of microservices architecture serving 2M+ users</p>
                  <p>{"\u2022"} Managed team of 5 engineers across frontend and backend</p>
                  <p>{"\u2022"} Reduced API latency by 40% through caching optimization</p>
                  <p>{"\u2022"} Built CI/CD pipeline reducing deploy time from 2hrs to 15min</p>
                </div>
              </div>
              {/* right: tailored with animated highlights */}
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-green-400">Tailored</p>
                  <span className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-[8px] text-green-400">{"\u2713"}</span>
                  </span>
                </div>
                <div className="space-y-3 text-sm font-mono leading-relaxed text-gray-400">
                  <p>
                    {"\u2022"} Led development of{" "}
                    <span className="diff-highlight" style={{ animationDelay: "0.3s" }}>cloud-native</span>{" "}
                    microservices architecture serving 2M+{" "}
                    <span className="diff-highlight" style={{ animationDelay: "0.6s" }}>daily active</span>{" "}
                    users
                  </p>
                  <p>
                    {"\u2022"} Managed{" "}
                    <span className="diff-highlight" style={{ animationDelay: "0.9s" }}>cross-functional</span>{" "}
                    team of 5 engineers{" "}
                    <span className="diff-highlight" style={{ animationDelay: "1.2s" }}>delivering full-stack solutions</span>
                  </p>
                  <p>
                    {"\u2022"} Reduced API latency by 40% through{" "}
                    <span className="diff-highlight" style={{ animationDelay: "1.5s" }}>Redis caching and query</span>{" "}
                    optimization
                  </p>
                  <p>
                    {"\u2022"}{" "}
                    <span className="diff-highlight" style={{ animationDelay: "1.8s" }}>Architected</span>{" "}
                    CI/CD pipeline{" "}
                    <span className="diff-highlight" style={{ animationDelay: "2.1s" }}>with automated testing</span>{" "}
                    reducing deploy time to 15min
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3 pt-4">
                  <span className="diff-badge text-[11px] font-medium bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full border border-red-500/20">
                    ATS: 42
                  </span>
                  <span className="diff-badge text-gray-600 text-xs">{"\u2192"}</span>
                  <span className="diff-badge text-[11px] font-medium bg-green-500/15 text-green-400 px-2.5 py-1 rounded-full border border-green-500/20">
                    ATS: 87
                  </span>
                  <span className="diff-badge text-[11px] font-medium bg-green-500/15 text-green-400 px-2.5 py-1 rounded-full border border-green-500/20">
                    +8 improvements
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* glow */}
          <div aria-hidden className="absolute -bottom-10 inset-x-0 flex justify-center">
            <div className="w-2/3 h-16 bg-green-500/10 blur-3xl rounded-full" />
          </div>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="py-10 border-y border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap justify-center gap-8 text-sm text-gray-500">
          {[
            "Matches keywords automatically",
            "Results in under 10 seconds",
            "Keeps your formatting",
            "Your data stays private",
          ].map((item) => (
            <span key={item} className="font-medium">{item}</span>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Everything you need to land the job</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              From tailoring to cover letters — every step handled.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: "AI",
                title: "AI RolePatching",
                desc: "Paste any job description and AI rewrites your resume to highlight the most relevant skills and experience.",
              },
              {
                icon: "Diff",
                title: "Live Diff View",
                desc: "See exactly what changed \u2014 additions in green, removals in red. Full transparency, no surprises.",
              },
              {
                icon: "CL",
                title: "Cover Letter Generator",
                desc: "Generate a compelling, personalised cover letter for each application with one click.",
              },
              {
                icon: "RM",
                title: "Resume Manager",
                desc: "Store multiple versions of your resume. Create tailored variants without touching your original.",
              },
              {
                icon: "AT",
                title: "Application Tracker",
                desc: "Track every application \u2014 draft, tailored, applied, interview, offer. Never lose track.",
              },
              {
                icon: "ATS",
                title: "ATS Score",
                desc: "Instant keyword match score against the job description. See your score jump from 42 to 87 after tailoring \u2014 no AI tokens used.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-gray-800 p-6 hover:border-green-500/40 hover:bg-green-500/[0.02] transition-all duration-200"
              >
                <div className="text-xs font-bold mb-3 w-10 h-10 rounded-lg bg-gray-800/50 flex items-center justify-center text-gray-400">{f.icon}</div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── See Every Change ── */}
      <section className="py-28 px-6 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
              See every change. Keep what you like.
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Unlike black-box tools, RolePatch shows exactly what AI changed — word
              by word. Additions in green, removals in red. Accept everything, or edit
              individual changes.
            </p>
          </div>

          {/* Detailed diff mock */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 shadow-2xl shadow-black/40 overflow-hidden">
            {/* toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-950/60">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-green-400 font-medium">+14 additions</span>
                <span className="text-red-400 font-medium">-6 removals</span>
                <span className="text-red-400/80 font-medium bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">ATS: 42</span>
                <span className="text-gray-600">{"\u2192"}</span>
                <span className="text-green-400 font-medium bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">ATS: 87</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-gray-700 overflow-hidden text-xs">
                <span className="px-3 py-1.5 bg-gray-800 text-white font-medium">Split view</span>
                <span className="px-3 py-1.5 text-gray-500">Inline view</span>
              </div>
            </div>

            {/* diff body */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-800">
              {/* before */}
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-5">Before</p>
                <div className="space-y-4 text-sm font-mono leading-relaxed">
                  <div className="flex gap-3">
                    <span className="text-gray-600 text-xs w-5 text-right shrink-0 pt-0.5">1</span>
                    <p className="text-gray-500">
                      {"\u2022"} Developed{" "}
                      <span className="bg-[#2d1215] text-red-400 rounded px-1">web applications</span>{" "}
                      using React and Node.js
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-600 text-xs w-5 text-right shrink-0 pt-0.5">2</span>
                    <p className="text-gray-500">
                      {"\u2022"}{" "}
                      <span className="bg-[#2d1215] text-red-400 rounded px-1">Worked on</span>{" "}
                      database optimization improving query performance
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-600 text-xs w-5 text-right shrink-0 pt-0.5">3</span>
                    <p className="text-gray-500">
                      {"\u2022"} Collaborated with design team to{" "}
                      <span className="bg-[#2d1215] text-red-400 rounded px-1">implement UI features</span>
                    </p>
                  </div>
                </div>
              </div>
              {/* after */}
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-400 mb-5">After</p>
                <div className="space-y-4 text-sm font-mono leading-relaxed">
                  <div className="flex gap-3">
                    <span className="text-gray-600 text-xs w-5 text-right shrink-0 pt-0.5">1</span>
                    <p className="text-gray-400">
                      {"\u2022"} Developed{" "}
                      <span className="diff-highlight" style={{ animationDelay: "0.4s" }}>production-grade SaaS applications</span>{" "}
                      using React and Node.js
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-600 text-xs w-5 text-right shrink-0 pt-0.5">2</span>
                    <p className="text-gray-400">
                      {"\u2022"}{" "}
                      <span className="diff-highlight" style={{ animationDelay: "0.8s" }}>Led</span>{" "}
                      database optimization improving query performance{" "}
                      <span className="diff-highlight" style={{ animationDelay: "1.2s" }}>by 60%</span>
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-600 text-xs w-5 text-right shrink-0 pt-0.5">3</span>
                    <p className="text-gray-400">
                      {"\u2022"} Collaborated with design team to{" "}
                      <span className="diff-highlight" style={{ animationDelay: "1.6s" }}>deliver accessible, responsive interfaces using Figma-to-code workflow</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-28 px-6 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Three steps. Under a minute.</h2>
            <p className="text-gray-400 text-lg">
              From cold resume to tailored application.
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                step: "01",
                title: "Upload your resume",
                desc: "Paste your existing resume in markdown or plain text. Store multiple versions for different roles.",
              },
              {
                step: "02",
                title: "Add the job description",
                desc: "Paste the job posting URL or text. We scrape and analyse the requirements automatically.",
              },
              {
                step: "03",
                title: "Review, edit & apply",
                desc: "AI tailors your resume, showing a diff of every change. Edit anything, then export and apply.",
              },
            ].map((s) => (
              <div key={s.step} className="flex gap-5 items-start p-5 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-green-500/10 text-green-400 font-bold text-sm flex items-center justify-center border border-green-500/20">
                  {s.step}
                </div>
                <div className="pt-0.5">
                  <h3 className="font-semibold text-lg text-white mb-1">{s.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-28 px-6 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Loved by job seekers</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                quote: "I went from 0 callbacks to 3 interviews in a week. The diff view is a game changer.",
                name: "Alex T.",
                role: "Software Engineer",
              },
              {
                quote: "Finally a tool that doesn't just keyword-stuff. The tailoring actually reads naturally.",
                name: "Priya M.",
                role: "Product Manager",
              },
              {
                quote: "The cover letter generator saved me hours. Each one actually sounds like me.",
                name: "Jordan K.",
                role: "UX Designer",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-xl border border-gray-800 p-6 space-y-4"
              >
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="text-green-400 text-sm">{"\u2605"}</span>
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-400">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-white">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative rounded-2xl border border-gray-800 p-14 overflow-hidden">
            {/* bg glow */}
            <div aria-hidden className="absolute inset-0 flex items-center justify-center">
              <div className="w-[400px] h-[200px] bg-green-500/10 blur-[80px] rounded-full" />
            </div>
            <div className="relative space-y-6">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                Start tailoring today
              </h2>
              <p className="text-gray-400 text-lg">
                3 free tokens to start. No credit card required.
              </p>
              <div className="flex flex-col items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-block bg-white text-gray-900 font-bold px-10 py-4 rounded-xl text-lg hover:bg-gray-200 transition-colors"
                >
                  {"Get started free \u2192"}
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm text-gray-400 hover:text-green-400 transition-colors underline underline-offset-4 decoration-gray-700 hover:decoration-green-400/50"
                >
                  View pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-green-500 flex items-center justify-center text-[7px] font-bold text-white">RP</span>
            <span className="font-semibold text-gray-300">RolePatch</span>
          </div>
          <span>{"\u00a9"} {new Date().getFullYear()} RolePatch</span>
          <div className="flex gap-6">
            <Link href="/dashboard" className="hover:text-gray-200 transition-colors">App</Link>
            <Link href="/pricing" className="hover:text-gray-200 transition-colors">Pricing</Link>
            <Link href="/tools" className="hover:text-gray-200 transition-colors">Tools</Link>
            <Link href="/blog" className="hover:text-gray-200 transition-colors">Blog</Link>
            <Link href="/privacy" className="hover:text-gray-200 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-200 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
