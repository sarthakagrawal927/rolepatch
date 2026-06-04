import { Award, BarChart3, FileText, Globe, MessageSquare, Search, Shield, Star, Target, Zap } from "lucide-react";
import Link from "next/link";
import Script from "next/script";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RolePatch",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://rolepatch.com",
  description: "AI-powered resume tailoring with job fit scoring, interview prep, and transparent diff view. See exactly what changed, word by word.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "3 free tokens to start. No credit card required.",
  },
};

const howItWorks = [
  {
    step: "01",
    title: "Paste the job",
    desc: "Drop in any job posting URL. RolePatch scrapes and analyzes the requirements, hard skills, and keywords the role is screening for.",
  },
  {
    step: "02",
    title: "Tailor & review",
    desc: "AI rewrites your resume to match — shown as a word-level diff, so you see and control every single change before you accept it.",
  },
  {
    step: "03",
    title: "Score & prep",
    desc: "Get a fit score across five weighted dimensions, then auto-generate STAR+R interview stories mapped to the job.",
  },
];

const builtOn = ["Next.js", "Turso", "Cloudflare"];


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] font-sans selection:bg-indigo-500/30 selection:text-white">
      <Script
        id="rolepatch-structured-data"
        strategy="beforeInteractive"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-xs font-black text-white">RP</span>
            <span className="font-bold text-xl tracking-tight text-white">RolePatch</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#proof" className="hover:text-white transition-colors">See it work</a>
            <Link href="/tools" prefetch={false} className="hover:text-white transition-colors">Free Tools</Link>
            <Link href="/pricing" prefetch={false} className="hover:text-white transition-colors">Pricing</Link>
          </nav>
          <Link
            href="/dashboard"
            prefetch={false}
            className="bg-white text-black text-sm font-bold px-6 py-2.5 rounded-full hover:bg-white/90 transition-all"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative pt-32 pb-28 px-6 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[100px] animate-pulse delay-1000" />
          </div>

          <div className="relative max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold tracking-widest uppercase text-indigo-400 mb-10">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Next-Gen AI Tailoring
            </div>

            <h1 className="text-7xl md:text-[100px] font-bold leading-[0.9] tracking-tight mb-10">
              The AI that gets you <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400">more interviews.</span>
            </h1>

            <p className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto leading-relaxed font-medium mb-12">
              Don&apos;t just apply. Score your fit, tailor your resume, and prep for interviews — all from one AI-powered command center.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
              <Link
                href="/dashboard"
                prefetch={false}
                className="group relative px-10 py-5 bg-white text-black font-black text-lg rounded-2xl hover:scale-105 transition-all duration-300 shadow-[0_20px_50px_rgba(255,255,255,0.1)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative group-hover:text-white transition-colors">Start Building Now — It&apos;s Free</span>
              </Link>
              <a
                href="#features"
                className="px-10 py-5 bg-white/5 text-white font-bold text-lg rounded-2xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"
              >
                See Features <Zap className="w-5 h-5 fill-current" />
              </a>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-20">
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Built for speed, <br/> tuned for precision.</h2>
              <p className="text-xl text-white/50 leading-relaxed font-medium">AI that understands what recruiters are actually looking for.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Target, title: "Job Fit Score", desc: "AI evaluates your match across 5 weighted dimensions — role alignment, skills, experience level, keywords, and culture fit. Know before you apply." },
                { icon: Zap, title: "Contextual Rewriting", desc: "Our AI doesn't just swap words; it re-contextualizes your experience to match the role's needs. See every change in a word-level diff." },
                { icon: MessageSquare, title: "Interview Prep", desc: "Auto-generates STAR+R stories mapped to the job requirements. Walk into every interview with rehearsed, quantified answers." },
                { icon: Search, title: "Deep JD Analysis", desc: "Extracts hard skills, soft skills, and cultural nuances from any job posting. Paste a URL and we scrape the rest." },
                { icon: BarChart3, title: "ATS Optimization", desc: "Real-time keyword scoring shows exactly which terms you're hitting and missing. Close the gap before you submit." },
                { icon: FileText, title: "Cover Letters", desc: "AI-generated cover letters with company research baked in. Maps your proof points directly to their requirements." },
              ].map((f, i) => (
                <div key={i} className="group p-8 rounded-3xl bg-[#0c0c0c] border border-white/5 hover:border-indigo-500/50 transition-all duration-500 hover:translate-y-[-4px]">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform duration-500">
                    <f.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-white/50 leading-relaxed font-medium">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="py-32 px-6 border-t border-[var(--border)]">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mb-20">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--muted)] border border-[var(--border)] text-[10px] font-bold tracking-widest uppercase text-[var(--accent)] mb-6">
                <Award className="w-3 h-3" />
                How it works
              </div>
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-[var(--foreground)]">
                From job post to<br /> tailored resume.
              </h2>
              <p className="text-xl text-[var(--muted-foreground)] leading-relaxed font-medium">
                Three steps from a link to an application that speaks the role&apos;s language.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {howItWorks.map((s) => (
                <div
                  key={s.step}
                  className="flex flex-col p-8 rounded-3xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-colors duration-500"
                >
                  <div className="text-3xl font-black text-[var(--accent)] mb-6">{s.step}</div>
                  <h3 className="text-xl font-bold mb-3 text-[var(--foreground)]">{s.title}</h3>
                  <p className="text-[var(--muted-foreground)] leading-relaxed font-medium">{s.desc}</p>
                </div>
              ))}
            </div>

            {/* Built on — understated tech stack row */}
            <div className="mt-24 pt-10 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Built on
              </span>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 grayscale opacity-60">
                {builtOn.map((tech) => (
                  <span
                    key={tech}
                    className="text-sm font-semibold text-[var(--muted-foreground)] tracking-tight"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
        {/* ── Before / After Proof ── */}
        <section id="proof" className="py-32 px-6 border-t border-[var(--border)]">
          <div className="max-w-5xl mx-auto">

            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--muted)] border border-[var(--border)] text-[10px] font-bold tracking-widest uppercase text-[var(--accent)]">
                <Zap className="w-3 h-3" />
                Real Output
              </div>
            </div>

            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-center">
              See your resume{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400">transform.</span>
            </h2>
            <p className="text-xl text-white/50 text-center mb-14 max-w-2xl mx-auto leading-relaxed font-medium">
              One generic bullet. One job posting URL. This is what RolePatch produces.
            </p>

            <div className="flex justify-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 font-medium">
                <Target className="w-4 h-4 text-indigo-400 shrink-0" />
                Tailored for:{" "}
                <span className="text-white font-semibold ml-1">Senior Product Manager · Stripe</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {/* Before */}
              <div className="p-8 rounded-3xl bg-[#0c0c0c] border border-white/5">
                <span className="inline-block px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest mb-6">
                  Before
                </span>
                <p className="text-white/50 text-lg leading-relaxed font-medium">
                  &ldquo;Worked with engineering teams to deliver product features and track key metrics.&rdquo;
                </p>
              </div>

              {/* After */}
              <div className="p-8 rounded-3xl bg-[#0c0c0c] border border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.08)]">
                <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-6">
                  After
                </span>
                <p className="text-white text-lg leading-relaxed font-medium">
                  &ldquo;Owned end-to-end roadmap for{" "}
                  <mark className="bg-emerald-500/20 text-emerald-300 rounded px-0.5 not-italic">3 payment API products</mark>
                  , partnering with{" "}
                  <mark className="bg-emerald-500/20 text-emerald-300 rounded px-0.5 not-italic">12 engineers</mark>
                  {" "}to ship{" "}
                  <mark className="bg-emerald-500/20 text-emerald-300 rounded px-0.5 not-italic">$4.2M ARR feature expansion</mark>
                  {" "}and cut time-to-first-transaction by{" "}
                  <mark className="bg-emerald-500/20 text-emerald-300 rounded px-0.5 not-italic">31%</mark>.&rdquo;
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-white/20 font-medium uppercase tracking-widest mb-10">
              Highlighted text = AI-added specificity · every change shown in a word-level diff
            </p>

            <div className="flex justify-center">
              <Link
                href="/dashboard"
                prefetch={false}
                className="group relative px-10 py-5 bg-white text-black font-black text-lg rounded-2xl hover:scale-105 transition-all duration-300 shadow-[0_20px_50px_rgba(255,255,255,0.1)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative group-hover:text-white transition-colors">Tailor Your Resume Free →</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-16 mb-16">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-6">
                <span className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[9px] font-black text-white">RP</span>
                <span className="font-bold text-lg tracking-tight">RolePatch</span>
              </div>
              <p className="text-white/40 max-w-sm leading-relaxed font-medium">
                AI-powered resume tailoring. Score your fit, tailor your resume, prep for interviews.
              </p>
            </div>
            <div className="space-y-5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/20">Product</h4>
              <nav className="flex flex-col gap-3 text-sm text-white/50 font-medium">
                <Link href="/tools" prefetch={false} className="hover:text-white transition-colors">Free Tools</Link>
                <Link href="/pricing" prefetch={false} className="hover:text-white transition-colors">Pricing</Link>
                <Link href="/dashboard" prefetch={false} className="hover:text-white transition-colors">Dashboard</Link>
              </nav>
            </div>
            <div className="space-y-5">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/20">Legal</h4>
              <nav className="flex flex-col gap-3 text-sm text-white/50 font-medium">
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              </nav>
            </div>
          </div>
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-sm text-white/20 font-medium">
              &copy; {new Date().getFullYear()} RolePatch. Built for the modern job seeker.
            </p>
            <div className="flex gap-6 opacity-20 hover:opacity-100 transition-opacity">
              <Globe className="w-5 h-5 cursor-pointer" />
              <Shield className="w-5 h-5 cursor-pointer" />
              <Star className="w-5 h-5 cursor-pointer" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
