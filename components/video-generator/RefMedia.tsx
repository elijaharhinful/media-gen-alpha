'use client';

import { X, Upload } from 'lucide-react';
import Image from 'next/image';
import { getMentionColor } from '@/lib/mention-colors';

// ── RefSection ────────────────────────────────────────────────────────────────

interface RefSectionProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onAdd: () => void;
  canAdd: boolean;
  hint?: string;
  children?: React.ReactNode;
}

export function RefSection({ icon, label, sublabel, onAdd, canAdd, hint, children }: RefSectionProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}{label}
          {sublabel && <span className="text-muted-foreground/50 font-normal">{sublabel}</span>}
        </span>
        <div className="flex items-center gap-2">
          {hint && (
            <span className="hidden sm:block text-[10px] text-muted-foreground/50 truncate max-w-[180px]">{hint}</span>
          )}
          {canAdd && (
            <button
              onClick={onAdd}
              className="w-7 h-7 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground hover:text-purple-400 hover:border-purple-400/50 transition-colors"
            >
              <Upload className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── MentionBadge ──────────────────────────────────────────────────────────────
// Shared colored border + number badge applied to image/video/audio thumbnails

interface MentionBadgeProps {
  index: number; // 1-based
  children: React.ReactNode;
  onRemove: () => void;
}

export function MentionBadge({ index, children, onRemove }: MentionBadgeProps) {
  const color = getMentionColor(index);
  return (
    <div
      className="relative rounded-lg overflow-hidden flex-shrink-0"
      style={{ border: `2px solid ${color}` }}
    >
      {children}
      {/* Number badge */}
      <span
        className="absolute bottom-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold leading-none"
        style={{ background: color, color: '#000' }}
      >
        {index}
      </span>
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500 transition-colors z-10"
      >
        <X className="h-2.5 w-2.5 text-white" />
      </button>
    </div>
  );
}

// ── ImageRefThumb ─────────────────────────────────────────────────────────────

interface ImageRefThumbProps {
  preview: string;
  index: number;
  onRemove: () => void;
}

export function ImageRefThumb({ preview, index, onRemove }: ImageRefThumbProps) {
  return (
    <MentionBadge index={index} onRemove={onRemove}>
      <div className="w-14 h-14">
        <Image src={preview} alt={`ref ${index}`} fill className="object-cover" />
      </div>
    </MentionBadge>
  );
}

// ── MediaChip (video / audio) ─────────────────────────────────────────────────

interface MediaChipProps {
  name: string;
  index: number;
  icon: React.ReactNode;
  onRemove: () => void;
}

export function MediaChip({ name, index, icon, onRemove }: MediaChipProps) {
  const color = getMentionColor(index);
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 border"
      style={{
        background: `${color}18`,
        borderColor: `${color}44`,
      }}
    >
      {/* Colored number badge */}
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style={{ background: color, color: '#000' }}
      >
        {index}
      </span>
      <span style={{ color }} className="flex-shrink-0">{icon}</span>
      <span className="text-[10px] max-w-[80px] truncate" style={{ color }}>{name}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-red-400 transition-colors ml-0.5">
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

// ── AddThumb ──────────────────────────────────────────────────────────────────

export function AddThumb({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-14 h-14 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center text-muted-foreground hover:border-purple-400/40 hover:text-purple-400 transition-colors flex-shrink-0"
    >
      <Upload className="h-3.5 w-3.5" />
    </button>
  );
}
