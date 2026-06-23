"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";
import { BACKEND_URL } from "@/lib/backend";

// react-pdf touches browser-only APIs; render it client-side only.
const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

type StatusResp = {
  status: "downloading" | "indexing" | "ready" | "error";
  paper_name?: string | null;
  chunk_count?: number | null;
  error?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  downloading: "Downloading the PDF…",
  indexing: "Building the AI index (embedding & chunking)…",
};

export default function PaperPage() {
  const params = useParams<{ req_id: string }>();
  const reqId = params.req_id;

  const [state, setState] = useState<StatusResp | null>(null);
  const [pendingHighlight, setPendingHighlight] = useState<string | null>(null);

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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-2.5 dark:border-white/10">
        <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50">
          ← Home
        </Link>
        <span className="truncate px-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {state?.paper_name || "Loading paper…"}
        </span>
        <span className="w-12" />
      </header>

      {!isReady ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          {isError ? (
            <>
              <p className="text-red-600 dark:text-red-400">Failed to process this paper.</p>
              <p className="max-w-md text-sm text-zinc-500">{state?.error}</p>
              <Link href="/" className="text-sm font-medium underline">
                Try another paper
              </Link>
            </>
          ) : (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
              <p className="text-sm text-zinc-500">
                {STATUS_LABEL[state?.status ?? "downloading"] ?? "Preparing…"}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="h-full w-[70%] border-r border-black/10 dark:border-white/10">
            <PdfViewer url={`${BACKEND_URL}/pdf/${reqId}`} onHighlightAsk={setPendingHighlight} />
          </div>
          <div className="h-full w-[30%]">
            <ChatPanel
              reqId={reqId}
              pendingHighlight={pendingHighlight}
              clearHighlight={() => setPendingHighlight(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
