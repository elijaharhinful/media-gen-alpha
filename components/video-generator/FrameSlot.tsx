'use client';

import { X, Upload, ImageIcon } from 'lucide-react';
import Image from 'next/image';

export interface FrameImage {
  file: File;
  preview: string;
  frameType: 'first_frame' | 'last_frame';
}

interface FrameSlotProps {
  label: string;
  subtitle: string;
  optional?: boolean;
  image: FrameImage | null;
  onUpload: () => void;
  onRemove: () => void;
}

export function FrameSlot({ label, subtitle, optional = false, image, onUpload, onRemove }: FrameSlotProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 overflow-hidden">
      {image ? (
        <div className="relative aspect-video">
          <Image src={image.preview} alt={label} fill className="object-cover" />
          <button
            onClick={onRemove}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            <X className="h-3 w-3 text-white" />
          </button>
        </div>
      ) : (
        <button
          onClick={onUpload}
          className="w-full aspect-video flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-purple-400/5 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <ImageIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{label}</span>
            {optional && <span className="text-[10px] text-muted-foreground/60">(optional)</span>}
          </div>
          <span className="text-[10px] text-muted-foreground/60">{subtitle}</span>
          <div className="mt-2 w-7 h-7 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center hover:border-purple-400/50 transition-colors">
            <Upload className="h-3 w-3" />
          </div>
        </button>
      )}
    </div>
  );
}
