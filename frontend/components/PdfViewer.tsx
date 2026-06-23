"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Worker version must match react-pdf's bundled pdfjs-dist (5.4.296).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type Popover = { x: number; y: number; text: string } | null;

export default function PdfViewer({
  url,
  onHighlightAsk,
}: {
  url: string;
  onHighlightAsk: (text: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [popover, setPopover] = useState<Popover>(null);

  // Track container width so pages fit the 70% pane responsively.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth - 48);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text || !selection || selection.rangeCount === 0) {
      setPopover(null);
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setPopover({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
      text,
    });
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="relative h-full overflow-y-auto bg-zinc-200 dark:bg-zinc-800"
    >
      <div className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-black/10 bg-white/90 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-zinc-900/90">
        <button
          onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
          className="rounded-md border border-black/10 px-2 py-1 text-sm dark:border-white/15"
        >
          −
        </button>
        <span className="text-xs text-zinc-500">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(2.4, s + 0.2))}
          className="rounded-md border border-black/10 px-2 py-1 text-sm dark:border-white/15"
        >
          +
        </button>
      </div>

      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<div className="p-8 text-center text-zinc-500">Loading PDF…</div>}
        error={<div className="p-8 text-center text-red-600">Failed to load PDF.</div>}
        className="flex flex-col items-center gap-4 py-4"
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={width ? width * scale : undefined}
            renderTextLayer
            renderAnnotationLayer
            className="shadow-lg"
          />
        ))}
      </Document>

      {popover && (
        <button
          style={{ left: popover.x, top: Math.max(popover.y - 40, 8) }}
          onClick={() => {
            onHighlightAsk(popover.text);
            setPopover(null);
            window.getSelection()?.removeAllRanges();
          }}
          className="absolute z-20 -translate-x-1/2 rounded-full bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-lg hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
        >
          ✨ Ask AI
        </button>
      )}
    </div>
  );
}
