import Link from "next/link";
import { Check, ArrowRight, Zap, Star, Shield, Search, FileText, Layout, BarChart3, Globe, Target, MessageSquare } from "lucide-react";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ResumeTailor",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://resumetailor.com",
  description: "AI-powered resume tailoring with job fit scoring, interview prep, and transparent diff view. See exactly what changed, word by word.",
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
    <div className="min-h-screen bg-[#050505] text-[#f0f0f0] font-sans selection:bg-indigo-500/30 selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-2xl transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-sm font-black text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] group-hover:scale-110 transition-transform duration-300">RT</div>
            <span className="font-bold text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">ResumeTailor</span>
          </div>
          <nav className="hidden md:flex items-center gap-10 text-sm font-medium text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <Link href="/tools" className="hover:text-white transition-colors">Free Tools</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </nav>
          <Link
            href="/dashboard"
            className="bg-white text-black text-sm font-bold px-7 py-3 rounded-full hover:bg-white/90 transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Start Tailoring Free
          </Link>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative pt-40 pb-32 px-6 overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[100px] animate-pulse delay-1000" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full opacity-20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/5 rounded-full opacity-10" />
          </div>

          <div className="relative max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold tracking-widest uppercase text-indigo-400 mb-10 animate-fade-in">
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

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                href="/dashboard"
                className="group relative px-10 py-5 bg-white text-black font-black text-lg rounded-2xl hover:scale-105 transition-all duration-300 shadow-[0_20px_50px_rgba(255,255,255,0.1)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative group-hover:text-white transition-colors">Start Building Now — It&apos;s Free</span>
              </Link>
              <a
                href="#how-it-works"
                className="px-10 py-5 bg-white/5 text-white font-bold text-lg rounded-2xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-2"
              >
                Watch Demo <Zap className="w-5 h-5 fill-current" />
              </a>
            </div>

            {/* Trusted by section */}
            <div className="mt-24 pt-12 border-t border-white/5">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white/30 mb-8">Trusted by talent at</p>
              <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale contrast-125">
                {/* Mock logos */}
                {['Google', 'Netflix', 'Stripe', 'Airbnb', 'Linear', 'Vercel'].map((brand) => (
                  <span key={brand} className="text-xl font-bold tracking-tighter">{brand}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-40 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Built for speed, <br/> tuned for precision.</h2>
                <p className="text-xl text-white/50 leading-relaxed font-medium">We analyzed thousands of job descriptions to build an AI that understands what recruiters are actually looking for.</p>
              </div>
              <div className="flex gap-4">
                {/* Simple stats */}
                <div className="px-6 py-4 rounded-3xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold text-white">98%</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">ATS Score Avg</div>
                </div>
                <div className="px-6 py-4 rounded-3xl bg-white/5 border border-white/10">
                  <div className="text-2xl font-bold text-white">2.4s</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Tailor Speed</div>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-10">
              {[
                { icon: Target, title: "Job Fit Score", desc: "AI evaluates your match across 5 weighted dimensions — role alignment, skills, experience level, keywords, and culture fit. Know before you apply." },
                { icon: Zap, title: "Contextual Rewriting", desc: "Our AI doesn't just swap words; it re-contextualizes your experience to match the role's needs. See every change in a word-level diff." },
                { icon: MessageSquare, title: "Interview Prep", desc: "Auto-generates STAR+R stories mapped to the job requirements. Walk into every interview with rehearsed, quantified answers." },
                { icon: Search, title: "Deep JD Analysis", desc: "Extracts hard skills, soft skills, and cultural nuances from any job posting. Paste a URL and we scrape the rest." },
                { icon: BarChart3, title: "ATS Optimization", desc: "Real-time keyword scoring shows exactly which terms you're hitting and missing. Close the gap before you submit." },
                { icon: FileText, title: "Cover Letters", desc: "AI-generated cover letters with company research baked in. Maps your proof points directly to their requirements." },
              ].map((f, i) => (
                <div key={i} className="group p-10 rounded-[40px] bg-[#0c0c0c] border border-white/5 hover:border-indigo-500/50 transition-all duration-500 hover:translate-y-[-8px]">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-8 group-hover:scale-110 transition-transform duration-500">
                    <f.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{f.title}</h3>
                  <p className="text-white/50 leading-relaxed text-lg font-medium">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-24 border-t border-white/5 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-16 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-black">RT</div>
                <span className="font-bold text-xl tracking-tighter">ResumeTailor</span>
              </div>
              <p className="text-white/40 max-w-sm leading-relaxed font-medium">
                The world&apos;s most advanced AI resume tailoring engine. Helping you land your dream job, one tailor at a time.
              </p>
            </div>
            <div className="space-y-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white/20">Product</h4>
              <nav className="flex flex-col gap-4 text-white/50 font-medium">
                <Link href="/tools" className="hover:text-white transition-colors">Free Tools</Link>
                <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              </nav>
            </div>
            <div className="space-y-6">
              <h4 className="text-sm font-bold uppercase tracking-widest text-white/20">Legal</h4>
              <nav className="flex flex-col gap-4 text-white/50 font-medium">
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              </nav>
            </div>
          </div>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
            <p className="text-sm text-white/20 font-medium">
              &copy; {new Date().getFullYear()} ResumeTailor. Built for the modern job seeker.
            </p>
            <div className="flex gap-8 opacity-20 hover:opacity-100 transition-opacity">
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
