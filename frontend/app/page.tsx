import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth";
import HomeClient from "@/components/HomeClient";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="relative h-screen overflow-hidden paper-grain text-on-surface selection:bg-primary selection:text-white flex flex-col">
      {/* Centered Watermark (Guy on Horse) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] pointer-events-none z-0 mix-blend-multiply opacity-[0.06] select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="w-full h-auto object-contain mx-auto"
          alt=""
          src="/guy_on_horse.png"
        />
      </div>

      {/* TopAppBar */}
      <header className="shrink-0 w-full z-50 bg-[#f6f3f2]/80 backdrop-blur-md border-b border-outline-variant/30">
        <div className="flex justify-between items-center w-full h-16 px-5 md:px-16 max-w-[1280px] mx-auto">
          <div className="font-display text-xl md:text-2xl font-medium text-primary tracking-tight">
            Arxiv Researcher
          </div>
          <div className="flex items-center space-x-6">
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 min-h-0 px-5 md:px-16 max-w-[1280px] mx-auto flex flex-col items-center justify-center overflow-hidden">
        {/* Hero */}
        <section className="w-full max-w-4xl text-center flex flex-col items-center">
          <div className="mb-2 text-primary/60">
            <span
              className="material-symbols-outlined text-[32px]"
              style={{ fontVariationSettings: "'wght' 100" }}
            >
              menu_book
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-on-surface mb-3 leading-tight max-w-3xl font-semibold tracking-tight">
            Read any arxiv paper with an AI assistant
          </h1>
          <p className="font-display text-base md:text-lg text-on-surface-variant mb-5 max-w-xl mx-auto leading-relaxed italic opacity-90">
            “Paste an arxiv link. We’ll load the PDF and let you chat with it,
            highlight passages, and ask questions.”
          </p>
          <div className="w-full max-w-2xl">
            <HomeClient />
            <div className="mt-5 flex justify-center items-center gap-4">
              <div className="w-16 h-px bg-outline-variant" />
              <span className="text-xs text-outline uppercase tracking-widest italic font-display">
                Digital Scriptorium
              </span>
              <div className="w-16 h-px bg-outline-variant" />
            </div>
          </div>
        </section>

        {/* Feature Bento Grid (Uniform 3-Column Cards) */}
        <section className="mt-6 w-full grid grid-cols-1 md:grid-cols-3 gap-4 z-10">
          {/* Card 1: Synthesized Annotations */}
          <div className="border border-outline-variant/30 p-4 bg-white hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between rounded-sm">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-xl"
                  style={{ fontVariationSettings: "'wght' 200" }}
                >
                  edit_note
                </span>
                <h3 className="font-display text-sm uppercase tracking-wide text-on-surface font-semibold">
                  Synthesized Annotations
                </h3>
              </div>
              <p className="font-body text-on-surface-variant leading-relaxed text-xs">
                Parses complex mathematical notations and references into
                clear, conversational insights.
              </p>
            </div>
          </div>

          {/* Card 2: Semantic Archive */}
          <div className="border border-outline-variant/30 p-4 bg-white hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between rounded-sm">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-xl"
                  style={{ fontVariationSettings: "'wght' 200" }}
                >
                  history_edu
                </span>
                <h3 className="font-display text-sm uppercase tracking-wide text-on-surface font-semibold">
                  Semantic Archive
                </h3>
              </div>
              <p className="font-body text-on-surface-variant leading-relaxed text-xs">
                Cross-references every paper with your library, building a
                connected knowledge graph.
              </p>
            </div>
          </div>

          {/* Card 3: Instant Citations */}
          <div className="border border-outline-variant/30 p-4 bg-white hover:border-primary/30 transition-all group shadow-sm flex flex-col justify-between rounded-sm">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform text-xl"
                  style={{ fontVariationSettings: "'wght' 200" }}
                >
                  format_quote
                </span>
                <h3 className="font-display text-sm uppercase tracking-wide text-on-surface font-semibold">
                  Instant Citations
                </h3>
              </div>
              <p className="font-body text-on-surface-variant leading-relaxed text-xs">
                Export bibtex or formatted citations directly from the
                conversation.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="shrink-0 w-full border-t border-outline-variant/30 py-3 px-5 md:px-16 z-10 relative bg-[#f6f3f2]">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-xs text-on-surface-variant opacity-60">
            Arxiv Researcher © 2024. All research is a conversation with the
            past.
          </p>
          <div className="flex gap-8">
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
