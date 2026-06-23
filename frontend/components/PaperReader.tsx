"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { v4 as uuidv4 } from "uuid";
import ChatPanel from "@/components/ChatPanel";
import AnnotatedPanel from "@/components/AnnotatedPanel";
import CitationsPanel from "@/components/CitationsPanel";
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jumpToPage, setJumpToPage] = useState<{ page: number; timestamp: number } | null>(null);
  const [citationHighlight, setCitationHighlight] = useState<{ page: number; text: string; timestamp: number } | null>(null);

  // Layout state
  const [activeView, setActiveView] = useState<"library" | "annotated" | "citations">("library");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<'pdf' | 'chat'>('pdf');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const toolsHidden = sidebarCollapsed && chatCollapsed;

  const toggleTools = useCallback(() => {
    const next = !toolsHidden;
    setSidebarCollapsed(next);
    setChatCollapsed(next);
  }, [toolsHidden]);

  // Cmd+/ (Mac) or Ctrl+/ (Windows) toggles both the sidebar and the AI chat.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        toggleTools();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTools]);

  function jumpToPdfPage(page: number) {
    setActiveView("library");
    setJumpToPage({ page, timestamp: Date.now() });
  }

  function jumpToCitation(page: number, text?: string) {
    setActiveView("library");
    if (text) {
      setCitationHighlight({ page, text, timestamp: Date.now() });
    } else {
      setJumpToPage({ page, timestamp: Date.now() });
    }
  }

  async function handleDeleteHighlight(id: string) {
    try {
      const res = await fetch(`/api/highlights?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHighlights((prev) => prev.filter((h) => h.id !== id));
      } else {
        console.error("Failed to delete highlight");
      }
    } catch (err) {
      console.error("Error deleting highlight:", err);
    }
  }

  function newChat() {
    setSessionId(uuidv4());
    setChatMessages([]);
  }

  async function selectSession(targetSessionId: string) {
    try {
      const res = await fetch(`/api/chat?paper_id=${reqId}&session_id=${targetSessionId}`);
      const data = await res.json();
      setSessionId(data.session_id ?? targetSessionId);
      setChatMessages(data.messages ?? []);
    } catch (err) {
      console.error("Failed to load chat session:", err);
    }
  }

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

    // Fetch the most recent chat session (or start a fresh client-side one)
    fetch(`/api/chat?paper_id=${reqId}`)
      .then((res) => res.json())
      .then((data) => {
        setSessionId(data.session_id ?? uuidv4());
        setChatMessages(data.messages ?? []);
      })
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

  async function askAI(message: string, highlight: string | null, attachments?: Attachment[], webSearch?: boolean) {
    if (chatLoading) return;

    // 1. Instantly append user message to local state
    const userMsg: Message = {
      role: "user",
      content: message,
      highlight: highlight || undefined,
      attachments: attachments?.map((a) => ({ name: a.name, mime_type: a.mime_type })),
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
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
          session_id: sessionId || undefined,
          web_search: webSearch || false,
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
          { role: "assistant", content: data.answer, citations: data.citations, webSources: data.web_sources },
        ]);
        if (data.session_id && data.session_id !== sessionId) {
          setSessionId(data.session_id);
        }
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
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex ${sidebarCollapsed ? "w-20" : "w-64"} shrink-0 flex-col border-r border-outline-variant bg-surface-container-low py-8 transition-all duration-300 md:relative md:translate-x-0 ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`mb-12 flex items-center ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-6"}`}>
          {!sidebarCollapsed && (
            <div>
              <h1 className="font-headline-md text-headline-md tracking-tight text-primary">
                The Archive
              </h1>
              <p className="mt-1 font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                Academic Session
              </p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 rounded-sm p-2 text-secondary transition-colors hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined">
              {sidebarCollapsed ? "left_panel_open" : "left_panel_close"}
            </span>
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          <Link
            href="/"
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center gap-4 rounded-sm bg-primary-container px-4 py-3 text-on-primary transition-transform active:scale-[0.98]"
          >
            <span className="material-symbols-outlined">menu_book</span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest">
              Library
            </span>
          </Link>
          <button
            onClick={() => { setActiveView("annotated"); setMobileSidebarOpen(false); }}
            title="Annotated"
            className={`flex w-full items-center gap-4 rounded-sm px-4 py-3 transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            } ${activeView === "annotated" ? "bg-primary-container text-on-primary" : "text-secondary hover:bg-surface-container-high"}`}
          >
            <span className="material-symbols-outlined">edit_note</span>
            {!sidebarCollapsed && (
              <span className="font-label-sm text-label-sm uppercase tracking-widest">Annotated</span>
            )}
          </button>
          <button
            onClick={() => { setActiveView("citations"); setMobileSidebarOpen(false); }}
            title="Citations"
            className={`flex w-full items-center gap-4 rounded-sm px-4 py-3 transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            } ${activeView === "citations" ? "bg-primary-container text-on-primary" : "text-secondary hover:bg-surface-container-high"}`}
          >
            <span className="material-symbols-outlined">format_quote</span>
            {!sidebarCollapsed && (
              <span className="font-label-sm text-label-sm uppercase tracking-widest">Citations</span>
            )}
          </button>
          <button
            title="AI Scroll"
            className={`flex w-full items-center gap-4 rounded-sm px-4 py-3 text-secondary transition-colors hover:bg-surface-container-high ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <span className="material-symbols-outlined">history_edu</span>
            {!sidebarCollapsed && (
              <span className="font-label-sm text-label-sm uppercase tracking-widest">AI Scroll</span>
            )}
          </button>
          <button
            title="Settings"
            className={`flex w-full items-center gap-4 rounded-sm px-4 py-3 text-secondary transition-colors hover:bg-surface-container-high ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <span className="material-symbols-outlined">settings</span>
            {!sidebarCollapsed && (
              <span className="font-label-sm text-label-sm uppercase tracking-widest">Settings</span>
            )}
          </button>
        </nav>
        <div className="mt-8 px-4">
          <Link
            href="/"
            title="New Research"
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary-container py-4 text-center font-label-sm text-label-sm uppercase tracking-widest text-on-primary transition-all hover:brightness-110"
          >
            {sidebarCollapsed ? <span className="material-symbols-outlined text-[20px]">add</span> : "New Research"}
          </Link>
        </div>
        <div className="mt-auto space-y-1 px-4">
          <button
            title="Support"
            className={`flex items-center gap-4 rounded-sm px-4 py-2 text-secondary transition-colors hover:text-primary ${
              sidebarCollapsed ? "w-full justify-center" : ""
            }`}
          >
            <span className="material-symbols-outlined">help_outline</span>
            {!sidebarCollapsed && <span className="font-label-sm text-label-sm uppercase">Support</span>}
          </button>
          <div
            className={`mt-4 flex items-center gap-3 border-t border-outline-variant px-4 py-4 ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <div className="w-8 h-8 shrink-0 rounded-full bg-secondary-container flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="font-label-sm text-label-sm font-bold uppercase truncate" title={userEmail}>
                  {userEmail}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Top App Bar */}
        <header className="flex h-14 md:h-20 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-3 md:px-8 gap-2">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 md:hidden text-on-surface hover:bg-surface-container rounded-sm transition-colors shrink-0"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="flex-1 min-w-0 mr-2 md:mr-4">
            <h2 className="truncate font-headline-md text-sm md:text-headline-md italic text-on-surface max-w-4xl">
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
        ) : activeView === "annotated" ? (
          <div className="flex flex-1 overflow-hidden paper-grain">
            <AnnotatedPanel
              highlights={highlights}
              onJumpToPage={jumpToPdfPage}
              onDelete={handleDeleteHighlight}
            />
          </div>
        ) : activeView === "citations" ? (
          <div className="flex flex-1 overflow-hidden paper-grain">
            <CitationsPanel paperId={reqId} onCitationClick={jumpToCitation} />
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden paper-grain">
              <section
                className={`${chatCollapsed ? "md:flex-1" : "md:w-[65%]"} h-full border-r border-outline-variant transition-all duration-300 ${mobileTab === 'pdf' ? 'flex flex-col' : 'hidden'} md:flex md:flex-col`}
              >
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
                  jumpToPage={jumpToPage}
                  citationHighlight={citationHighlight}
                  toolsHidden={toolsHidden}
                  onToggleTools={toggleTools}
                />
              </section>
              <section className={`${chatCollapsed ? "md:w-14" : "md:w-[35%]"} h-full transition-all duration-300 ${mobileTab === 'chat' ? 'flex flex-col' : 'hidden'} md:flex md:flex-col w-full`}>
                <ChatPanel
                  messages={chatMessages}
                  loading={chatLoading}
                  onSendMessage={askAI}
                  pendingHighlight={pendingHighlight}
                  clearHighlight={() => setPendingHighlight(null)}
                  onScrollToPage={(page) => setJumpToPage({ page, timestamp: Date.now() })}
                  onCitationClick={jumpToCitation}
                  collapsed={chatCollapsed}
                  onToggleCollapse={() => setChatCollapsed((v) => !v)}
                  paperId={reqId}
                  activeSessionId={sessionId}
                  onNewChat={newChat}
                  onSelectSession={selectSession}
                />
              </section>
            </div>
            {/* Mobile tab bar */}
            <div className="flex md:hidden border-t border-outline-variant bg-surface shrink-0">
              <button
                onClick={() => setMobileTab('pdf')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${mobileTab === 'pdf' ? 'text-primary bg-surface-container' : 'text-secondary'}`}
              >
                <span className="material-symbols-outlined text-[18px]">description</span>
                PDF
              </button>
              <button
                onClick={() => setMobileTab('chat')}
                className={"flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-widest transition-colors " + (mobileTab === 'chat' ? 'text-primary bg-surface-container' : 'text-secondary')}
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                Chat
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
