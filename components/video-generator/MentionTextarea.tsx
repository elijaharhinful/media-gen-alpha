"use client";

import { useRef, useEffect, useCallback } from "react";
import { parsePromptSegments } from "@/lib/mention-colors";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

/**
 * A textarea with a synchronized overlay that renders @mention tokens
 * in their unique colors while the actual <textarea> remains transparent.
 *
 * Architecture:
 *   - A <div> overlay (pointer-events:none) renders the colored HTML
 *   - A <textarea> sits on top (transparent text, caret visible)
 *   - Both share identical font/size/padding so content lines up perfectly
 */
export function MentionTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  className = "",
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Keep overlay scroll in sync with textarea scroll
  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener("scroll", syncScroll);
    return () => ta.removeEventListener("scroll", syncScroll);
  }, [syncScroll]);

  // Build the highlighted HTML from segments
  const buildHighlightedHtml = (text: string): string => {
    const segments = parsePromptSegments(text);
    return segments
      .map((seg) => {
        if (seg.type === "text") {
          // Escape HTML and preserve whitespace/newlines
          return seg.value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br/>");
        }
        return `<span style="color:${seg.color};font-weight:600">${seg.raw}</span>`;
      })
      .join("");
  };

  const sharedStyle =
    "w-full bg-background/60 px-4 py-3 text-sm min-h-[110px] " +
    "leading-relaxed tracking-normal font-sans overflow-auto whitespace-pre-wrap break-words";

  return (
    <div className="relative rounded-xl border border-border bg-background/60 overflow-hidden focus-within:ring-2 focus-within:ring-purple-400/40 transition-all">
      {/* Highlight overlay */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={`${sharedStyle} absolute inset-0 pointer-events-none select-none resize-none`}
        style={{ color: "inherit" }}
        dangerouslySetInnerHTML={{ __html: buildHighlightedHtml(value) || "" }}
      />

      {/* Real textarea — transparent text so overlay shows through */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        placeholder={placeholder}
        className={`${sharedStyle} relative z-10 resize-none focus:outline-none bg-transparent ${className}`}
        style={{ color: "transparent", caretColor: "white" }}
      />
    </div>
  );
}
