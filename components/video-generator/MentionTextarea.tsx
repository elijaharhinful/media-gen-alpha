"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import getCaretCoordinates from "textarea-caret";
import { parsePromptSegments } from "@/lib/mention-colors";
import { ImageIcon, Video, Volume2, User as UserIcon } from "lucide-react";

export interface MentionOption {
  type: "image" | "video" | "audio" | "character";
  id: string;
  display: string;
  insertText: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  mentionOptions?: MentionOption[];
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  className = "",
  mentionOptions = [],
  onPaste,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [filterText, setFilterText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredOptions = mentionOptions.filter(
    (opt) =>
      opt.display.toLowerCase().includes(filterText.toLowerCase()) ||
      opt.insertText.toLowerCase().includes(filterText.toLowerCase())
  );

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

  // Handle keydown for mentions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (dropdownOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredOptions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredOptions.length > 0) {
          insertMention(filteredOptions[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDropdownOpen(false);
      }
    }
  };

  const updateMentions = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const currentVal = ta.value;
    const cursorPos = ta.selectionStart;
    const textBeforeCursor = currentVal.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf("@");

    if (lastAtPos !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtPos + 1);
      // Ensure there are no spaces after @ to keep it active
      if (!/\s/.test(textAfterAt)) {
        setFilterText(textAfterAt);
        setSelectedIndex(0);
        
        // Calculate position
        const coords = getCaretCoordinates(ta, lastAtPos);
        const lineHeight = coords.height;
        const taHeight = ta.offsetHeight;
        const spaceBelow = taHeight - (coords.top + lineHeight - ta.scrollTop);
        const estimatedDropdownHeight = 240; 
        
        let top = coords.top + lineHeight + 4 - ta.scrollTop;
        
        // Flip up if space below is tight and there's more space above
        if (spaceBelow < estimatedDropdownHeight && coords.top > estimatedDropdownHeight) {
          top = coords.top - estimatedDropdownHeight - 4 - ta.scrollTop;
        }

        setDropdownPos({
          top,
          left: coords.left - ta.scrollLeft,
        });
        setDropdownOpen(true);
        return;
      }
    }
    
    setDropdownOpen(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateMentions();
  };

  const insertMention = (opt: MentionOption) => {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const cursorPos = ta.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf("@");

    if (lastAtPos !== -1) {
      const newText =
        value.slice(0, lastAtPos) +
        "@" +
        opt.insertText +
        " " +
        textAfterCursor;
      onChange(newText);
      setDropdownOpen(false);
      
      // Focus back and set cursor
      setTimeout(() => {
        ta.focus();
        const newPos = lastAtPos + 1 + opt.insertText.length + 1;
        ta.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const buildHighlightedHtml = (text: string): string => {
    const segments = parsePromptSegments(text);
    return segments
      .map((seg) => {
        if (seg.type === "text") {
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
    "w-full bg-background/60 px-4 py-3 text-sm rounded-xl " +
    "leading-relaxed tracking-normal font-sans overflow-auto whitespace-pre-wrap break-words";

  return (
    <div className={`relative rounded-xl border border-border bg-background/60 focus-within:ring-2 focus-within:ring-purple-400/40 transition-all ${className}`}>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={`${sharedStyle} absolute inset-0 h-full pointer-events-none select-none`}
        style={{ color: "inherit" }}
        dangerouslySetInnerHTML={{ __html: buildHighlightedHtml(value) || "" }}
      />

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        onClick={updateMentions}
        onKeyUp={updateMentions}
        onPaste={onPaste}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`${sharedStyle} relative z-10 resize-y focus:outline-none bg-transparent w-full min-h-[110px]`}
        style={{ color: "transparent", caretColor: "white" }}
      />

      {dropdownOpen && filteredOptions.length > 0 && (
        <div
          className="absolute z-50 bg-[#25252b] border border-border/50 rounded-xl shadow-xl overflow-y-auto py-1 min-w-[200px] max-h-[240px] scrollbar-thin scrollbar-thumb-white/10"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {filteredOptions.map((opt, idx) => (
            <button
              key={opt.id + idx}
              onClick={(e) => { e.preventDefault(); insertMention(opt); }}
              onMouseDown={(e) => e.preventDefault()} // Keep focus on textarea
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                idx === selectedIndex ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {opt.type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
              {opt.type === 'video' && <Video className="w-3.5 h-3.5" />}
              {opt.type === 'audio' && <Volume2 className="w-3.5 h-3.5" />}
              {opt.type === 'character' && <UserIcon className="w-3.5 h-3.5" />}
              {opt.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
