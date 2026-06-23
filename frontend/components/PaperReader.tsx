"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";
import { BACKEND_URL } from "@/lib/backend";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

type StatusResp = {
  status: "downloading" | "indexing" | "ready" | "error";
  paper_name?: string | null;
  chunk_count?: number | null;
  error?: string | null;
};

type Highlight = {
  id: string;
  text: string;
  note?: string | null;
  color: string;
  page_number: number;
};

type Citation = { page: number; section_path: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  highlight?: string;
};

const STATUS_LABEL: Record<string, string> = {
  downloading: "Downloading the PDF…",
  indexing: "Building the AI index (embedding & chunking)…",
};

export default function PaperReader({
  reqId,
  userEmail,
}: {
  reqId: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<StatusResp | null>(null);
  const [pendingHighlight, setPendingHighlight] = useState<{ text: string; pageNumber: number } | null>(null);

  // DB States
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`${BACKEND_URL}/status/${reqId}`);
        if (res.ok) {
          const data: StatusResp = await res.json();
          if (!active) return;
          setState(data);
          if (data.status === "ready" || data.status === "error") return;
        }
      } catch {
        /* keep polling */
      }
      timer = setTimeout(poll, 1500);
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [reqId]);

  const isReady = state?.status === "ready";
  const isError = state?.status === "error";

  // Fetch highlights and chat messages when ready
  useEffect(() => {
    if (!isReady) return;

    // Fetch existing highlights
    fetch(`/api/highlights?paper_id=${reqId}`)
      .then((res) => res.json())
      .then((data) => setHighlights(data))
      .catch((err) => console.error("Failed to load highlights:", err));

    // Fetch existing chat history
    fetch(`/api/chat?paper_id=${reqId}`)
      .then((res) => res.json())
      .then((data) => setChatMessages(data))
      .catch((err) => console.error("Failed to load chat history:", err));
  }, [isReady, reqId]);

  async function handleAddHighlight(text: string, note: string, color: string, pageNumber: number) {
    try {
      const res = await fetch("/api/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: reqId,
          text,
          note: note.trim() || null,
          color,
          page_number: pageNumber,
        }),
      });
      if (res.ok) {
        const newHighlight = await res.json();
        setHighlights((prev) => [...prev, newHighlight]);
      } else {
        console.error("Failed to save highlight to database");
      }
    } catch (err) {
      console.error("Error saving highlight:", err);
    }
  }

  async function askAI(message: string, highlight: string | null) {
    if (chatLoading) return;

    // 1. Instantly append user message to local state
    const userMsg: Message = {
      role: "user",
      content: message,
      highlight: highlight || undefined,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);
    setPendingHighlight(null); // Clear active highlight selection

    // 2. Call our API proxy to get answer and persist both messages
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: reqId,
          message,
          highlight: highlight || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Something went wrong." },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer, citations: data.citations },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Could not reach the assistant." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface font-body-md text-on-surface">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-outline-variant bg-surface-container-low py-8 transition-all duration-300">
        <div className="mb-12 px-6">
          <h1 className="font-headline-md text-headline-md tracking-tight text-primary">
            The Archive
          </h1>
          <p className="mt-1 font-label-sm text-label-sm uppercase tracking-widest text-secondary">
            Academic Session
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          <Link
            href="/"
            className="flex items-center gap-4 rounded-sm bg-primary-container px-4 py-3 text-on-primary transition-transform active:scale-[0.98]"
          >
            <span className="material-symbols-outlined">menu_book</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">
              Library
            </span>
          </Link>
          <button className="flex w-full items-center gap-4 rounded-sm px-4 py-3 text-secondary transition-colors hover:bg-surface-container-high">
            <span className="material-symbols-outlined">edit_note</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">
              Annotated
            </span>
          </button>
          <button className="flex w-full items-center gap-4 rounded-sm px-4 py-3 text-secondary transition-colors hover:bg-surface-container-high">
            <span className="material-symbols-outlined">format_quote</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">
              Citations
            </span>
          </button>
          <button className="flex w-full items-center gap-4 rounded-sm px-4 py-3 text-secondary transition-colors hover:bg-surface-container-high">
            <span className="material-symbols-outlined">history_edu</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">
              AI Scroll
            </span>
          </button>
          <button className="flex w-full items-center gap-4 rounded-sm px-4 py-3 text-secondary transition-colors hover:bg-surface-container-high">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">
              Settings
            </span>
          </button>
        </nav>
        <div className="mt-8 px-4">
          <Link
            href="/"
            className="block w-full rounded-sm bg-primary-container py-4 text-center font-label-sm text-label-sm uppercase tracking-widest text-on-primary transition-all hover:brightness-110"
          >
            New Research
          </Link>
        </div>
        <div className="mt-auto space-y-1 px-4">
          <button className="flex items-center gap-4 rounded-sm px-4 py-2 text-secondary transition-colors hover:text-primary">
            <span className="material-symbols-outlined">help_outline</span>
            <span className="font-label-sm text-label-sm uppercase">Support</span>
          </button>
          <div className="mt-4 flex items-center gap-3 border-t border-outline-variant px-4 py-4">
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-label-sm text-label-sm font-bold uppercase truncate" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top App Bar */}
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-8">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="truncate font-headline-md text-headline-md italic text-on-surface max-w-4xl">
              {state?.paper_name || "Loading paper…"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={logout}
              className="px-6 py-2 bg-primary-container text-on-primary font-label-sm text-label-sm uppercase tracking-widest transition-transform active:scale-95 rounded-sm"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Content */}
        {!isReady ? (
          <div className="paper-grain flex flex-1 flex-col items-center justify-center gap-3 text-center">
            {isError ? (
              <>
                <p className="text-error">Failed to process this paper.</p>
                <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
                  {state?.error}
                </p>
                <Link
                  href="/"
                  className="font-label-sm text-label-sm uppercase tracking-widest text-primary underline"
                >
                  Try another paper
                </Link>
              </>
            ) : (
              <>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary-container" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {STATUS_LABEL[state?.status ?? "downloading"] ?? "Preparing…"}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden paper-grain">
            <section className="w-[65%] h-full border-r border-outline-variant">
              <PdfViewer
                url={`${BACKEND_URL}/pdf/${reqId}`}
                highlights={highlights}
                onAddHighlight={handleAddHighlight}
                onSelectionChange={(text, pageNumber) => {
                  setPendingHighlight({ text, pageNumber });
                }}
                onAskAI={async (text, note, pageNumber) => {
                  setPendingHighlight({ text, pageNumber });
                  await askAI(note, text);
                }}
              />
            </section>
            <section className="w-[35%] h-full">
              <ChatPanel
                messages={chatMessages}
                loading={chatLoading}
                onSendMessage={askAI}
                pendingHighlight={pendingHighlight}
                clearHighlight={() => setPendingHighlight(null)}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
