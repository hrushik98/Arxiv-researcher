"use client";

import { useEffect, useState } from "react";

type Citation = { page: number; section_path: string; text?: string };

type ChatMessage = {
  id: string;
  user_id: string;
  paper_id: string;
  role: "user" | "assistant";
  content: string;
  highlight: string | null;
  citations: Citation[] | null;
  session_id: string;
  created_at: string;
};

type CitationEntry = {
  key: string;
  question: string;
  answer: string;
  citations: Citation[];
  createdAt: string;
};

export default function CitationsPanel({
  paperId,
  onCitationClick,
}: {
  paperId: string;
  onCitationClick: (page: number, text?: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<CitationEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/chat?paper_id=${encodeURIComponent(paperId)}&all=true`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { session_id: string | null; messages: ChatMessage[] } = await res.json();
        const messages = data.messages ?? [];

        const pairs: CitationEntry[] = [];
        for (let i = 0; i < messages.length; i++) {
          const question = messages[i];
          if (question.role !== "user") continue;
          const answer = messages[i + 1];
          if (!answer || answer.role !== "assistant") continue;
          if (!answer.citations || answer.citations.length === 0) continue;

          pairs.push({
            key: answer.id ?? `${question.id}-${i}`,
            question: question.content,
            answer: answer.content,
            citations: answer.citations,
            createdAt: answer.created_at,
          });
        }

        pairs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (!cancelled) {
          setEntries(pairs);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load citations");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  return (
    <div className="flex h-full w-full flex-col bg-surface-container-lowest text-on-surface">
      <div className="p-4 md:p-6 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-primary-container"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            format_quote
          </span>
          <h3 className="font-headline-md text-lg md:text-headline-md tracking-tight text-on-surface">
            Citations
          </h3>
        </div>
        {!loading && !error && (
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        {loading && (
          <div className="flex h-full items-center justify-center text-on-surface-variant font-label-sm text-label-sm uppercase tracking-widest">
            Loading citations…
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-2xl">error</span>
            <p className="font-label-sm text-label-sm uppercase tracking-widest">
              Couldn&apos;t load citations
            </p>
            <p className="font-body-md text-sm text-on-surface-variant max-w-xs">{error}</p>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-on-surface-variant px-8">
            <span className="material-symbols-outlined text-2xl">format_quote</span>
            <p className="font-label-sm text-label-sm uppercase tracking-widest">No citations yet</p>
            <p className="font-body-md text-sm max-w-xs">
              Ask the assistant a question about this paper.
            </p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.key}
                className="rounded-sm border border-outline-variant bg-surface-container-low p-4 shadow-sm"
              >
                <p className="font-label-md text-sm text-on-surface mb-2">{entry.question}</p>
                <p className="font-body-md text-sm text-on-surface-variant line-clamp-3 mb-3">
                  {entry.answer}
                </p>
                <div className="flex flex-wrap gap-1">
                  {entry.citations.map((c, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => onCitationClick(c.page, c.text)}
                      className="rounded bg-secondary-container text-on-secondary-container px-2 py-0.5 text-[11px] font-label-sm uppercase tracking-wider transition-colors hover:bg-primary-container hover:text-on-primary cursor-pointer border-0 text-left"
                      title={c.section_path}
                    >
                      p. {c.page}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
