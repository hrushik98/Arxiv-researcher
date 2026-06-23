"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/backend";

type Citation = { page: number; section_path: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  highlight?: string;
};

export default function ChatPanel({
  reqId,
  pendingHighlight,
  clearHighlight,
}: {
  reqId: string;
  pendingHighlight: string | null;
  clearHighlight: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const highlight = pendingHighlight;
    setMessages((m) => [...m, { role: "user", content: message, highlight: highlight ?? undefined }]);
    setInput("");
    clearHighlight();
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ req_id: reqId, message, highlight }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: data.detail || "Something went wrong." }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.answer, citations: data.citations }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Could not reach the assistant." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950">
      <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Assistant</h2>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center text-sm text-zinc-400">
            <p className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">Ask anything about this paper.</p>
            <p>Or highlight text in the PDF and click ✨ Ask AI.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            {m.highlight && (
              <p className="mb-1 inline-block max-w-full truncate rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                “{m.highlight}”
              </p>
            )}
            <div
              className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
              }`}
            >
              {m.content}
            </div>
            {m.citations && m.citations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.citations.map((c, j) => (
                  <span
                    key={j}
                    className="rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    title={c.section_path}
                  >
                    p. {c.page}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && <div className="text-left text-sm text-zinc-400">Thinking…</div>}
      </div>

      <form onSubmit={send} className="border-t border-black/10 p-3 dark:border-white/10">
        {pendingHighlight && (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <span className="line-clamp-2 flex-1">Asking about: “{pendingHighlight}”</span>
            <button type="button" onClick={clearHighlight} className="font-bold">
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
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
            placeholder="Ask anything about this paper…"
            className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
