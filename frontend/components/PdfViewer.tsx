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

type Highlight = {
  id: string;
  text: string;
  note?: string | null;
  color: string;
  page_number: number;
};

type Popover = {
  x: number;
  y: number;
  text: string;
  pageNumber: number;
} | null;

// Normalize whitespace and map normalized indices to original string indices
function getNormalizedMapping(str: string) {
  let normalized = "";
  const indexMap: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (/\s/.test(char)) {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== " ") {
        normalized += " ";
        indexMap.push(i);
      }
    } else {
      normalized += char.toLowerCase();
      indexMap.push(i);
    }
  }
  return { normalized, indexMap };
}

// Clear custom highlights on a page
function clearHighlights(pageElement: HTMLElement) {
  const textLayer = pageElement.querySelector(".textLayer");
  if (!textLayer) return;
  const marks = textLayer.querySelectorAll("mark.pdf-highlight");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      const textNode = document.createTextNode(mark.textContent || "");
      parent.replaceChild(textNode, mark);
    }
  });
  textLayer.normalize();
}

// Apply a single highlight substring matching to a page textLayer DOM
function applyHighlight(textLayer: HTMLElement, highlightText: string, color: string) {
  const textNodes: Text[] = [];
  const walk = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walk.nextNode())) {
    textNodes.push(node as Text);
  }

  let cumulativeText = "";
  const ranges = textNodes.map((tn) => {
    const start = cumulativeText.length;
    cumulativeText += tn.nodeValue || "";
    const end = cumulativeText.length;
    return { node: tn, start, end };
  });

  const { normalized, indexMap } = getNormalizedMapping(cumulativeText);
  const normQuery = highlightText.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normQuery) return false;

  const matchIndex = normalized.indexOf(normQuery);
  if (matchIndex === -1) return false;

  const origStart = indexMap[matchIndex];
  const origEnd = indexMap[matchIndex + normQuery.length - 1] + 1;

  const nodesToReplace: Array<{
    node: Text;
    replacement: Node[];
  }> = [];

  for (const r of ranges) {
    if (r.end <= origStart || r.start >= origEnd) {
      continue;
    }

    const nodeOverlapStart = Math.max(origStart, r.start) - r.start;
    const nodeOverlapEnd = Math.min(origEnd, r.end) - r.start;
    const val = r.node.nodeValue || "";

    const beforeText = val.slice(0, nodeOverlapStart);
    const highlightedText = val.slice(nodeOverlapStart, nodeOverlapEnd);
    const afterText = val.slice(nodeOverlapEnd);

    const replacement: Node[] = [];
    if (beforeText) {
      replacement.push(document.createTextNode(beforeText));
    }
    if (highlightedText) {
      const mark = document.createElement("mark");
      if (color === "rainbow") {
        mark.style.backgroundImage = "linear-gradient(120deg, rgba(255, 138, 128, 0.45), rgba(255, 209, 128, 0.45), rgba(255, 255, 141, 0.5), rgba(204, 255, 144, 0.45), rgba(130, 177, 255, 0.45), rgba(179, 136, 255, 0.45))";
      } else {
        mark.style.backgroundColor = color;
      }
      mark.style.color = "inherit";
      mark.className = "pdf-highlight";
      mark.appendChild(document.createTextNode(highlightedText));
      replacement.push(mark);
    }
    if (afterText) {
      replacement.push(document.createTextNode(afterText));
    }

    nodesToReplace.push({ node: r.node, replacement });
  }

  for (const { node, replacement } of nodesToReplace) {
    const parent = node.parentNode;
    if (parent) {
      const fragment = document.createDocumentFragment();
      replacement.forEach((n) => fragment.appendChild(n));
      parent.replaceChild(fragment, node);
    }
  }

  return true;
}

export default function PdfViewer({
  url,
  highlights,
  onAddHighlight,
  onAskAI,
  onSelectionChange,
}: {
  url: string;
  highlights: Highlight[];
  onAddHighlight: (text: string, note: string, color: string, pageNumber: number) => Promise<void>;
  onAskAI: (text: string, note: string, pageNumber: number) => Promise<void>;
  onSelectionChange: (text: string, pageNumber: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [popover, setPopover] = useState<Popover>(null);

  // Tooltip form states
  const [note, setNote] = useState("");
  const [selectedColor, setSelectedColor] = useState("rgba(255, 255, 141, 0.5)"); // Default to yellow highlight

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

  // Apply highlights to all rendered pages in the DOM
  const applyAllHighlights = useCallback(() => {
    if (!containerRef.current) return;
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageEl = containerRef.current.querySelector(
        `.react-pdf__Page[data-page-number="${pageNum}"]`
      ) as HTMLElement | null;
      if (pageEl) {
        const textLayer = pageEl.querySelector(".textLayer") as HTMLElement | null;
        if (textLayer) {
          clearHighlights(pageEl);
          const pageHighlights = highlights.filter((h) => h.page_number === pageNum);
          for (const h of pageHighlights) {
            applyHighlight(textLayer, h.text, h.color);
          }
        }
      }
    }
  }, [highlights, numPages]);

  useEffect(() => {
    applyAllHighlights();
  }, [applyAllHighlights]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text || !selection || selection.rangeCount === 0) {
      setPopover(null);
      return;
    }

    // Find the page number of the selection
    let node: Node | null = selection.anchorNode;
    let pageNumber = 1;
    while (node) {
      if (node instanceof HTMLElement && node.classList.contains("react-pdf__Page")) {
        const pageNumAttr = node.getAttribute("data-page-number");
        if (pageNumAttr) {
          pageNumber = parseInt(pageNumAttr, 10);
        }
        break;
      }
      node = node.parentNode;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Reset notes
    setNote("");
    // Keep yellow as default selection
    setSelectedColor("rgba(255, 255, 141, 0.5)");

    setPopover({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
      text,
      pageNumber,
    });

    onSelectionChange(text, pageNumber);
  }, [onSelectionChange]);

  const handleHighlightClick = async () => {
    if (!popover) return;
    await onAddHighlight(popover.text, note, selectedColor, popover.pageNumber);
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleAskAIClick = async () => {
    if (!popover) return;
    const query = note.trim() || `Explain this passage: "${popover.text}"`;
    await onAskAI(popover.text, query, popover.pageNumber);
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleTranslateClick = async () => {
    if (!popover) return;
    const query = `Translate this passage:`;
    await onAskAI(popover.text, query, popover.pageNumber);
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        handleHighlightClick();
      } else if (!e.shiftKey) {
        e.preventDefault();
        handleAskAIClick();
      }
    }
  };

  const colors = [
    { solid: "#ff8a80", highlight: "rgba(255, 138, 128, 0.4)" },
    { solid: "#ffd180", highlight: "rgba(255, 209, 128, 0.45)" },
    { solid: "#ffff8d", highlight: "rgba(255, 255, 141, 0.5)" },
    { solid: "#ccff90", highlight: "rgba(204, 255, 144, 0.4)" },
    { solid: "#82b1ff", highlight: "rgba(130, 177, 255, 0.4)" },
    { solid: "#b388ff", highlight: "rgba(179, 136, 255, 0.4)" },
    { solid: "#f8bbd0", highlight: "rgba(248, 187, 208, 0.45)" },
    { solid: "rainbow", highlight: "rainbow" },
  ];

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="relative w-full h-full p-8 overflow-y-auto custom-scrollbar flex flex-col items-center"
    >
      <div className="flex items-center justify-between w-full max-w-4xl mb-6 sticky top-0 bg-surface-bright/80 backdrop-blur-sm p-4 border border-outline-variant rounded-sm z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            className="p-2 hover:bg-surface-container transition-colors text-on-surface"
          >
            <span className="material-symbols-outlined">zoom_out</span>
          </button>
          <span className="font-label-sm text-label-sm font-medium text-on-surface">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(2.4, s + 0.2))}
            className="p-2 hover:bg-surface-container transition-colors text-on-surface"
          >
            <span className="material-symbols-outlined">zoom_in</span>
          </button>
        </div>
        <div className="flex items-center gap-4 text-on-surface">
          <span className="font-label-sm text-label-sm">Page 1 of {numPages || "..."}</span>
          <div className="h-4 w-px bg-outline-variant"></div>
          <a
            href={url}
            download
            className="p-2 hover:bg-surface-container transition-colors flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined">download</span>
          </a>
          <button
            onClick={() => window.print()}
            className="p-2 hover:bg-surface-container transition-colors text-on-surface"
          >
            <span className="material-symbols-outlined">print</span>
          </button>
        </div>
      </div>

      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<div className="p-8 text-center text-zinc-500 font-body-md">Loading PDF…</div>}
        error={<div className="p-8 text-center text-red-600 font-body-md">Failed to load PDF.</div>}
        className="w-full max-w-4xl flex flex-col items-center"
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={width ? width * scale : undefined}
            renderTextLayer
            renderAnnotationLayer
            onRenderSuccess={() => {
              setTimeout(() => {
                applyAllHighlights();
              }, 100);
            }}
            className="pdf-frame border border-outline-variant bg-surface-container-lowest mb-12 shadow-lg"
          />
        ))}
      </Document>

      {popover && (
        <div
          style={{
            position: "absolute",
            left: popover.x,
            top: Math.max(popover.y - 120, 8),
            transform: "translateX(-50%)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          className="z-50 w-96 rounded-lg border border-zinc-200 bg-white shadow-xl flex flex-col pointer-events-auto text-zinc-800"
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add text here..."
            className="w-full text-sm outline-none resize-none p-3 border-b border-zinc-100 bg-transparent text-zinc-800 placeholder-zinc-400 font-sans"
            rows={2}
          />
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-50/50 rounded-b-lg">
            <div className="flex items-center gap-1.5">
              {colors.map((c, idx) => {
                const isRainbow = c.solid === "rainbow";
                const backgroundStyle = isRainbow
                  ? { backgroundImage: "linear-gradient(135deg, #ff8a80, #ffd180, #ffff8d, #ccff90, #82b1ff, #b388ff, #f8bbd0)" }
                  : { backgroundColor: c.solid };
                const isActive = selectedColor === c.highlight;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedColor(c.highlight)}
                    style={backgroundStyle}
                    className={`w-4 h-4 rounded-full border border-zinc-200/50 cursor-pointer transition-all hover:scale-110 flex items-center justify-center ${
                      isActive ? "ring-2 ring-zinc-400 ring-offset-1" : ""
                    }`}
                  />
                );
              })}
              <div className="w-px h-4 bg-zinc-200 mx-1"></div>
              <button
                type="button"
                onClick={handleTranslateClick}
                title="Translate"
                className="p-1 hover:bg-zinc-200/60 rounded text-zinc-500 transition-colors flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">translate</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleHighlightClick}
                className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-rose-600">border_color</span>
                <span>Highlight</span>
                <span className="text-[10px] text-zinc-400 font-normal ml-0.5">⌘↵</span>
              </button>
              <button
                type="button"
                onClick={handleAskAIClick}
                className="flex items-center gap-0.5 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-rose-600">auto_awesome</span>
                <span>Ask AI</span>
                <span className="text-[10px] text-zinc-400 font-normal ml-0.5">↵</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
