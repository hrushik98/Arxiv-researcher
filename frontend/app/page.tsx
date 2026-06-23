import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import HomeClient from "@/components/HomeClient";
import LogoutButton from "@/components/LogoutButton";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="relative min-h-screen paper-grain text-on-surface selection:bg-primary selection:text-white overflow-x-hidden">
      {/* Centered Watermark (Guy on Horse) */}
      <div className="absolute top-[380px] md:top-[440px] left-1/2 -translate-x-1/2 w-full max-w-[800px] pointer-events-none z-0 mix-blend-multiply opacity-[0.06] select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="w-full h-auto object-contain mx-auto"
          alt=""
          src="/guy_on_horse.png"
        />
      </div>

      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#f6f3f2]/80 backdrop-blur-md border-b border-outline-variant/30">
        <div className="flex justify-between items-center w-full h-20 px-5 md:px-16 max-w-[1280px] mx-auto">
          <div className="font-display text-2xl md:text-3xl font-medium text-primary tracking-tight">
            Arxiv Researcher
          </div>
          <div className="flex items-center space-x-6">
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 pt-40 md:pt-60 px-5 md:px-16 max-w-[1280px] mx-auto flex flex-col items-center">
        {/* Hero */}
        <section className="w-full max-w-4xl text-center flex flex-col items-center">
          <div className="mb-8 text-primary/60">
            <span
              className="material-symbols-outlined text-[48px]"
              style={{ fontVariationSettings: "'wght' 100" }}
            >
              menu_book
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-on-surface mb-6 leading-tight max-w-3xl font-semibold tracking-tight">
            Read any arxiv paper with an AI assistant
          </h1>
          <p className="font-display text-lg md:text-xl text-on-surface-variant mb-12 max-w-xl mx-auto leading-relaxed italic opacity-90">
            “Paste an arxiv link. We’ll load the PDF and let you chat with it,
            highlight passages, and ask questions.”
          </p>
          <div className="w-full max-w-2xl">
            <HomeClient />
            <div className="mt-12 flex justify-center items-center gap-4">
              <div className="w-16 h-px bg-outline-variant" />
              <span className="text-xs text-outline uppercase tracking-widest italic font-display">
                Digital Scriptorium
              </span>
              <div className="w-16 h-px bg-outline-variant" />
            </div>
          </div>
        </section>

        {/* Feature Bento Grid (Uniform 3-Column Cards) */}
        <section className="mt-32 w-full grid grid-cols-1 md:grid-cols-3 gap-8 pb-20 z-10">
          {/* Card 1: Synthesized Annotations */}
          <div className="border border-outline-variant/30 p-10 bg-white hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between rounded-sm">
            <div>
              <div className="mb-6 flex items-center gap-4">
                <span
                  className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform"
                  style={{ fontVariationSettings: "'wght' 200" }}
                >
                  edit_note
                </span>
                <h3 className="font-display text-xl uppercase tracking-wide text-on-surface font-semibold">
                  Synthesized Annotations
                </h3>
              </div>
              <p className="font-body text-on-surface-variant leading-relaxed text-sm">
                Our model parses complex mathematical notations and references into
                clear, conversational insights, effectively serving as a tireless
                research assistant for the modern scholar.
              </p>
            </div>
          </div>

          {/* Card 2: Semantic Archive */}
          <div className="border border-outline-variant/30 p-10 bg-white hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between rounded-sm">
            <div>
              <div className="mb-6">
                <span
                  className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform"
                  style={{ fontVariationSettings: "'wght' 200" }}
                >
                  history_edu
                </span>
              </div>
              <h3 className="font-display text-xl mb-4 text-on-surface font-semibold">
                Semantic Archive
              </h3>
              <p className="font-body text-on-surface-variant leading-relaxed text-sm">
                Every paper you read is cross-referenced with your personal
                library, building a knowledge graph that connects disparate
                theories.
              </p>
            </div>
          </div>

          {/* Card 3: Instant Citations */}
          <div className="border border-outline-variant/30 p-10 bg-white hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between rounded-sm">
            <div>
              <div className="mb-6">
                <span
                  className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform"
                  style={{ fontVariationSettings: "'wght' 200" }}
                >
                  format_quote
                </span>
              </div>
              <h3 className="font-display text-xl mb-4 text-on-surface font-semibold">
                Instant Citations
              </h3>
              <p className="font-body text-on-surface-variant leading-relaxed text-sm">
                Export bibtex or formatted citations directly from the
                conversation. Perfect for active manuscript drafting.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant/30 py-16 px-5 md:px-16 z-10 relative bg-[#f6f3f2]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.3em] text-primary opacity-60 mb-2 font-semibold">
              Ex Bibliotheca Digitalis
            </p>
            <p className="text-xs text-on-surface-variant opacity-60">
              Arxiv Researcher © 2024. All research is a conversation with the
              past.
            </p>
          </div>
          <div className="flex gap-12">
            <a className="text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors font-semibold" href="#">
              Privacy
            </a>
            <a className="text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors font-semibold" href="#">
              Terms
            </a>
            <a className="text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors font-semibold" href="#">
              API
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
