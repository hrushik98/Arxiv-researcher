"use client";

import { useEffect, useRef, useState } from "react";

type Citation = { page: number; section_path: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  highlight?: string;
};

export default function ChatPanel({
  messages,
  loading,
  onSendMessage,
  pendingHighlight,
  clearHighlight,
}: {
  messages: Message[];
  loading: boolean;
  onSendMessage: (message: string, highlight: string | null) => Promise<void>;
  pendingHighlight: { text: string; pageNumber: number } | null;
  clearHighlight: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message && !pendingHighlight) return;
    if (loading) return;

    setInput("");
    const query = message || "Explain this passage";
    await onSendMessage(query, pendingHighlight ? pendingHighlight.text : null);
  }

  return (
    <div className="flex h-full flex-col bg-surface-container-lowest text-on-surface border-l border-outline-variant">
      <div className="p-6 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
            history_edu
          </span>
          <h3 className="font-headline-md text-headline-md tracking-tight text-on-surface">AI Assistant</h3>
        </div>
        <button className="p-2 hover:bg-surface-container transition-colors rounded-full text-secondary">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="mt-8 text-center text-sm text-secondary font-label-sm">
            <p className="mb-2 font-bold text-on-surface uppercase tracking-widest">Assistant Scroll</p>
            <p className="mb-1">Ask anything about this paper.</p>
            <p>Or highlight text in the PDF and click ✨ Ask AI.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}>
            {m.role === "user" ? (
              <>
                {m.highlight && (
                  <blockquote className="border-l-2 border-primary-fixed bg-surface-container-low px-3 py-1.5 text-xs text-on-surface-variant italic mb-2 rounded-r-sm max-w-[85%] text-left">
                    “{m.highlight}”
                  </blockquote>
                )}
                <div className="bg-primary-container text-on-primary font-label-md text-sm rounded-xl px-4 py-3 max-w-[85%] text-left shadow-sm">
                  {m.content}
                </div>
              </>
            ) : (
              <>
                <div className="bg-surface-container-low text-on-surface font-body-md text-sm rounded-xl px-4 py-3 max-w-[85%] text-left border border-outline-variant shadow-sm whitespace-pre-wrap">
                  {m.content}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.citations.map((c, j) => (
                      <span
                        key={j}
                        className="rounded bg-secondary-container text-on-secondary-container px-2 py-0.5 text-[11px] font-label-sm uppercase tracking-wider transition-colors hover:bg-primary-container hover:text-on-primary cursor-help"
                        title={c.section_path}
                      >
                        p. {c.page}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-secondary font-label-sm">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-outline-variant border-t-primary-container" />
            <span>Assistant is scanning scrolls…</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-surface-container-lowest border-t border-outline-variant">
        <form onSubmit={send} className="border border-zinc-200 rounded-2xl p-4 bg-white shadow-sm flex flex-col gap-3 focus-within:border-zinc-400 transition-colors">
          {pendingHighlight && (
            <div className="border-l-2 border-amber-400 bg-amber-50/30 p-3 rounded-r-md text-xs relative flex items-start justify-between gap-4 select-none">
              <div className="flex-1">
                <span className="font-semibold text-zinc-500 block mb-0.5">Page {pendingHighlight.pageNumber}:</span>
                <span className="text-zinc-600 block line-clamp-3 leading-relaxed">{pendingHighlight.text}</span>
              </div>
              <button
                type="button"
                onClick={clearHighlight}
                className="text-zinc-400 hover:text-zinc-600 transition-colors text-[20px] leading-none px-1"
              >
                ×
              </button>
            </div>
          )}
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            rows={2}
            placeholder="Ask anything about this paper or highlight text..."
            className="w-full resize-none bg-transparent outline-none text-sm text-zinc-800 placeholder-zinc-400 min-h-[50px] font-sans"
          />

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 transition-colors"
                title="Attach file"
              >
                <span className="material-symbols-outlined text-[18px]">attach_file</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-rose-100 bg-rose-50/40 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-rose-600">language</span>
                <span>Search</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || (!input.trim() && !pendingHighlight)}
              className="w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
