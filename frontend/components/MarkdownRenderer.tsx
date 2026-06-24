"use client";

import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MarkdownRendererProps {
  content: string;
  onPageClick?: (page: number) => void;
}

interface Token {
  type: "text" | "math" | "bold" | "italic" | "citation";
  content: string;
  raw: string;
}

export default function MarkdownRenderer({ content, onPageClick }: MarkdownRendererProps) {
  // Split content into lines to parse blocks
  const lines = content.split("\n");
  const blocks: Array<{ type: "paragraph" | "list" | "math"; lines: string[] }> = [];
  let currentBlock: { type: "paragraph" | "list" | "math"; lines: string[] } | null = null;
  let insideMath = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for block math start/end
    if (line.trim().startsWith("$$") && !insideMath) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = { type: "math", lines: [line] };
      insideMath = true;
      if (line.trim().endsWith("$$") && line.trim().length > 2) {
        blocks.push(currentBlock);
        currentBlock = null;
        insideMath = false;
      }
      continue;
    }

    if (insideMath) {
      currentBlock?.lines.push(line);
      if (line.trim().endsWith("$$")) {
        blocks.push(currentBlock!);
        currentBlock = null;
        insideMath = false;
      }
      continue;
    }

    // Check for bullet list item
    const isListItem = line.trim().startsWith("* ") || line.trim().startsWith("- ");

    if (isListItem) {
      if (currentBlock && currentBlock.type !== "list") {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: "list", lines: [] };
      }
      // Strip leading "* " or "- "
      const bulletContent = line.trim().substring(2);
      currentBlock.lines.push(bulletContent);
    } else if (line.trim() === "") {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    } else {
      if (currentBlock && currentBlock.type !== "paragraph") {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: "paragraph", lines: [] };
      }
      currentBlock.lines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Tokenize inline content (math, bold, italic, citations)
  function tokenizeInline(text: string): Token[] {
    const tokens: Token[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      let firstMatchIndex = remaining.length;
      let firstMatchType: "math" | "bold" | "italic" | "citation" | null = null;
      let firstMatchLength = 0;
      let firstMatchContent = "";
      let firstMatchRaw = "";

      // 1. Math $...$
      const mathMatch = remaining.match(/\$([^\$]+?)\$/);
      if (mathMatch && mathMatch.index !== undefined && mathMatch.index < firstMatchIndex) {
        firstMatchIndex = mathMatch.index;
        firstMatchType = "math";
        firstMatchLength = mathMatch[0].length;
        firstMatchContent = mathMatch[1];
        firstMatchRaw = mathMatch[0];
      }

      // 2. Bold **...**
      const boldMatch = remaining.match(/\*\*([^\*]+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined && boldMatch.index < firstMatchIndex) {
        firstMatchIndex = boldMatch.index;
        firstMatchType = "bold";
        firstMatchLength = boldMatch[0].length;
        firstMatchContent = boldMatch[1];
        firstMatchRaw = boldMatch[0];
      }

      // 3. Italic *...*
      const italicMatch = remaining.match(/\*([^\*]+?)\*/);
      if (italicMatch && italicMatch.index !== undefined && italicMatch.index < firstMatchIndex) {
        const isBold = remaining.substring(italicMatch.index).startsWith("**");
        if (!isBold) {
          firstMatchIndex = italicMatch.index;
          firstMatchType = "italic";
          firstMatchLength = italicMatch[0].length;
          firstMatchContent = italicMatch[1];
          firstMatchRaw = italicMatch[0];
        }
      }

      // 4. Citation [p. ...] or [P. ...]
      const citationMatch = remaining.match(/\[[pP]\.\s*([^\]]+)\]/);
      if (citationMatch && citationMatch.index !== undefined && citationMatch.index < firstMatchIndex) {
        firstMatchIndex = citationMatch.index;
        firstMatchType = "citation";
        firstMatchLength = citationMatch[0].length;
        firstMatchContent = citationMatch[1];
        firstMatchRaw = citationMatch[0];
      }

      if (firstMatchIndex > 0) {
        tokens.push({
          type: "text",
          content: remaining.substring(0, firstMatchIndex),
          raw: remaining.substring(0, firstMatchIndex),
        });
      }

      if (firstMatchType) {
        tokens.push({
          type: firstMatchType,
          content: firstMatchContent,
          raw: firstMatchRaw,
        });
        remaining = remaining.substring(firstMatchIndex + firstMatchLength);
      } else {
        tokens.push({
          type: "text",
          content: remaining,
          raw: remaining,
        });
        break;
      }
    }

    return tokens;
  }

  function renderInline(text: string): React.ReactNode[] {
    const tokens = tokenizeInline(text);
    return tokens.map((token, index) => {
      switch (token.type) {
        case "bold":
          return <strong key={index} className="font-bold">{renderInline(token.content)}</strong>;
        case "italic":
          return <em key={index} className="italic">{renderInline(token.content)}</em>;
        case "math":
          try {
            const html = katex.renderToString(token.content, {
              displayMode: false,
              throwOnError: false,
            });
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: html }}
                className="inline-math font-serif px-0.5"
              />
            );
          } catch {
            return <code key={index} className="text-red-500 font-mono text-xs">${token.content}$</code>;
          }
        case "citation":
          return renderCitation(token.content, index);
        case "text":
        default:
          return token.content;
      }
    });
  }

  function renderCitation(citationText: string, key: number): React.ReactNode {
    const pageStrings = citationText.split(/,\s*/);
    const elements: React.ReactNode[] = [];

    elements.push("[p. ");
    pageStrings.forEach((pStr, idx) => {
      // Find the first number in the string (e.g. "2" in "2", or "5" in "5-7")
      const numMatch = pStr.match(/\d+/);
      const pageNum = numMatch ? parseInt(numMatch[0], 10) : null;

      if (pageNum) {
        elements.push(
          <button
            key={idx}
            type="button"
            onClick={() => onPageClick?.(pageNum)}
            className="inline-block text-primary font-bold hover:underline hover:text-primary-hover cursor-pointer"
            title={`Jump to Page ${pageNum}`}
          >
            {pStr}
          </button>
        );
      } else {
        elements.push(<span key={idx}>{pStr}</span>);
      }

      if (idx < pageStrings.length - 1) {
        elements.push(", ");
      }
    });
    elements.push("]");

    return <span key={key} className="inline-block font-sans text-xs">{elements}</span>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, idx) => {
        if (block.type === "math") {
          const mathContent = block.lines
            .join("\n")
            .replace(/^\$\$/, "")
            .replace(/\$\$$/, "");
          try {
            const html = katex.renderToString(mathContent, {
              displayMode: true,
              throwOnError: false,
            });
            return (
              <div
                key={idx}
                dangerouslySetInnerHTML={{ __html: html }}
                className="my-3 overflow-x-auto select-all max-w-full text-center"
              />
            );
          } catch {
            return (
              <pre key={idx} className="bg-red-50 text-red-500 p-2 rounded text-xs overflow-x-auto">
                {"$$\n" + mathContent + "\n$$"}
              </pre>
            );
          }
        }

        if (block.type === "list") {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {block.lines.map((line, lIdx) => (
                <li key={lIdx} className="leading-relaxed">
                  {renderInline(line)}
                </li>
              ))}
            </ul>
          );
        }

        // Paragraph block
        const paragraphText = block.lines.join(" ");
        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(paragraphText)}
          </p>
        );
      })}
    </div>
  );
}
