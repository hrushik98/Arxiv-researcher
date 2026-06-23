"use client";

import { useEffect, useRef, useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

type Citation = { page: number; section_path: string; text?: string };
type WebSource = { title: string; url: string };
type Attachment = { name: string; mime_type: string; data: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  webSources?: WebSource[];
  highlight?: string;
  attachments?: { name: string; mime_type: string }[];
};
type SessionSummary = {
  session_id: string;
  started_at: string;
  updated_at: string;
  preview: string | null;
};

// Formats an ISO timestamp as a short relative time (e.g. "5m ago", "3d ago").
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Read a File into a base64 string (without the data: URL prefix).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // keep request under Gemini's inline limit

export default function ChatPanel({
  messages,
  loading,
  onSendMessage,
  pendingHighlight,
  clearHighlight,
  onScrollToPage,
  onCitationClick,
  collapsed,
  onToggleCollapse,
  paperId,
  activeSessionId,
  onNewChat,
  onSelectSession,
}: {
  messages: Message[];
  loading: boolean;
  onSendMessage: (
    message: string,
    highlight: string | null,
    attachments?: Attachment[],
    webSearch?: boolean,
  ) => Promise<void>;
  pendingHighlight: { text: string; pageNumber: number } | null;
  clearHighlight: () => void;
  onScrollToPage?: (page: number) => void;
  onCitationClick?: (page: number, text?: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  paperId?: string;
  activeSessionId?: string | null;
  onNewChat?: () => void;
  onSelectSession?: (targetSessionId: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [forceWebSearch, setForceWebSearch] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Dismiss the History dropdown when clicking outside it.
  useEffect(() => {
    if (!historyOpen) return;
    function handleClick(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [historyOpen]);

  async function loadSessions() {
    if (!paperId) return;
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/chat/sessions?paper_id=${encodeURIComponent(paperId)}`);
      if (res.ok) {
        const data = (await res.json()) as SessionSummary[];
        setSessions(data);
      }
    } catch {
      // Best-effort: leave the previous list in place on failure.
    } finally {
      setSessionsLoading(false);
    }
  }

  function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) {
      void loadSessions();
    }
  }

  async function handleSelectSession(targetSessionId: string) {
    setHistoryOpen(false);
    await onSelectSession?.(targetSessionId);
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-14 flex-col items-center py-4 bg-surface-container-lowest border-l border-outline-variant">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-surface-container transition-colors rounded-full text-secondary"
          title="Expand Chat"
        >
          <span className="material-symbols-outlined">left_panel_open</span>
        </button>
      </div>
    );
  }

  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const tooBig = picked.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    const ok = picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (tooBig.length > 0) {
      alert(`These files exceed the 15 MB limit and were skipped:\n${tooBig.map((f) => f.name).join("\n")}`);
    }
    setFiles((prev) => [...prev, ...ok]);
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message && !pendingHighlight && files.length === 0) return;
    if (loading) return;

    const attachments: Attachment[] = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        mime_type: f.type || "application/octet-stream",
        data: await fileToBase64(f),
      })),
    );

    setInput("");
    setFiles([]);
    const query = message || (files.length > 0 ? "Please analyze the attached file(s)." : "Explain this passage");
    await onSendMessage(query, pendingHighlight ? pendingHighlight.text : null, attachments, forceWebSearch);
  }

  return (
    <div className="flex h-full flex-col bg-surface-container-lowest text-on-surface md:border-l border-outline-variant">
      <div className="p-4 md:p-6 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
            history_edu
          </span>
          <h3 className="font-headline-md text-lg md:text-headline-md tracking-tight text-on-surface">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-1 px-2 py-1.5 hover:bg-surface-container transition-colors rounded-full text-secondary font-label-sm text-label-sm"
            title="New Chat"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span className="hidden sm:inline">New Chat</span>
          </button>
          <div ref={historyRef} className="relative">
            <button
              type="button"
              onClick={toggleHistory}
              className="flex items-center gap-1 px-2 py-1.5 hover:bg-surface-container transition-colors rounded-full text-secondary font-label-sm text-label-sm"
              title="History"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              <span className="hidden sm:inline">History</span>
            </button>
            {historyOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto custom-scrollbar rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg z-20">
                {sessionsLoading && (
                  <div className="p-3 text-xs text-secondary font-label-sm">Loading…</div>
                )}
                {!sessionsLoading && sessions.length === 0 && (
                  <div className="p-3 text-xs text-secondary font-label-sm">No past conversations yet.</div>
                )}
                {!sessionsLoading &&
                  sessions.map((s) => (
                    <button
                      key={s.session_id}
                      type="button"
                      onClick={() => handleSelectSession(s.session_id)}
                      className={`w-full text-left px-3 py-2.5 border-b border-outline-variant last:border-b-0 hover:bg-surface-container transition-colors ${
                        s.session_id === activeSessionId ? "bg-secondary-container" : ""
                      }`}
                    >
                      <p className="text-sm text-on-surface truncate">{s.preview || "Untitled conversation"}</p>
                      <p className="mt-0.5 text-[11px] text-secondary font-label-sm">{formatRelativeTime(s.updated_at)}</p>
                    </button>
                  ))}
              </div>
            )}
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2 hover:bg-surface-container transition-colors rounded-full text-secondary"
              title="Collapse Chat"
            >
              <span className="material-symbols-outlined">right_panel_close</span>
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 md:space-y-6 overflow-y-auto p-4 md:p-6 custom-scrollbar">
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
                {m.attachments && m.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap justify-end gap-1.5 max-w-[85%]">
                    {m.attachments.map((a, k) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 rounded-md bg-surface-container-low border border-outline-variant px-2 py-1 text-[11px] text-on-surface-variant"
                        title={a.name}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {a.mime_type.startsWith("image/") ? "image" : "description"}
                        </span>
                        <span className="max-w-[140px] truncate">{a.name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="bg-primary-container text-on-primary font-label-md text-sm rounded-xl px-4 py-3 max-w-[85%] text-left shadow-sm">
                  {m.content}
                </div>
              </>
            ) : (
              <>
                <div className="bg-surface-container-low text-on-surface font-body-md text-sm rounded-xl px-4 py-3 max-w-[85%] text-left border border-outline-variant shadow-sm">
                  <MarkdownRenderer content={m.content} onPageClick={onScrollToPage} />
                </div>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.citations.map((c, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => onCitationClick?.(c.page, c.text)}
                        className="rounded bg-secondary-container text-on-secondary-container px-2 py-0.5 text-[11px] font-label-sm uppercase tracking-wider transition-colors hover:bg-primary-container hover:text-on-primary cursor-pointer border-0 text-left"
                        title={c.section_path}
                      >
                        p. {c.page}
                      </button>
                    ))}
                  </div>
                )}
                {m.webSources && m.webSources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.webSources.map((s, j) => (
                      <a
                        key={j}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-label-sm transition-colors hover:bg-primary-container hover:text-on-primary cursor-pointer"
                        title={s.url}
                      >
                        <span className="material-symbols-outlined text-[12px]">language</span>
                        <span className="max-w-[160px] truncate">{s.title || s.url}</span>
                      </a>
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

      <div className="p-3 md:p-4 bg-surface-container-lowest border-t border-outline-variant">
        <form onSubmit={send} className="border border-zinc-200 rounded-2xl p-3 md:p-4 bg-white shadow-sm flex flex-col gap-2 md:gap-3 focus-within:border-zinc-400 transition-colors">
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
          
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, idx) => {
                const isImage = f.type.startsWith("image/");
                return (
                  <div
                    key={idx}
                    className="group relative flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700"
                  >
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-rose-500">description</span>
                    )}
                    <span className="max-w-[120px] truncate font-medium">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-zinc-400 hover:text-zinc-700 transition-colors text-base leading-none"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.txt,.md,.csv"
                onChange={handleFilesPicked}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 transition-colors"
                title="Attach file"
              >
                <span className="material-symbols-outlined text-[18px]">attach_file</span>
              </button>
              <button
                type="button"
                onClick={() => setForceWebSearch((v) => !v)}
                aria-pressed={forceWebSearch}
                title={forceWebSearch ? "Web search on for this message" : "Search the web if the paper doesn't have the answer"}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                  forceWebSearch
                    ? "border-primary-container bg-primary-container text-on-primary"
                    : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${forceWebSearch ? "text-on-primary" : "text-primary"}`}>language</span>
                <span>Search</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || (!input.trim() && !pendingHighlight && files.length === 0)}
              className="w-9 h-9 rounded-full bg-primary-container hover:brightness-110 flex items-center justify-center text-on-primary transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
