'use client';

import { Clock, Monitor, Ratio } from 'lucide-react';

// ── Primitives ────────────────────────────────────────────────────────────────

export function SettingPillGroup({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide min-w-fit">
        {label}
      </span>
      {children}
    </div>
  );
}

export function PillBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
        active
          ? 'border-purple-400/60 bg-purple-400/15 text-purple-400'
          : 'border-border/50 bg-background/50 text-muted-foreground hover:text-foreground hover:border-border'
      }`}
    >
      {children}
    </button>
  );
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const RESOLUTIONS = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

export const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '21:9', label: '21:9' },
  { value: '9:21', label: '9:21' },
];

export const DURATIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// ── Composed settings row ─────────────────────────────────────────────────────

interface VideoSettingsProps {
  resolution: string;
  aspectRatio: string;
  duration: number;
  onResolutionChange: (v: string) => void;
  onAspectRatioChange: (v: string) => void;
  onDurationChange: (v: number) => void;
}

export function VideoSettings({
  resolution, aspectRatio, duration,
  onResolutionChange, onAspectRatioChange, onDurationChange,
}: VideoSettingsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
      <SettingPillGroup label={<><Monitor className="h-3 w-3" /> Res</>}>
        {RESOLUTIONS.map(r => (
          <PillBtn key={r.value} active={resolution === r.value} onClick={() => onResolutionChange(r.value)}>
            {r.label}
          </PillBtn>
        ))}
      </SettingPillGroup>

      <SettingPillGroup label={<><Ratio className="h-3 w-3" /> Aspect</>}>
        {ASPECT_RATIOS.map(ar => (
          <PillBtn key={ar.value} active={aspectRatio === ar.value} onClick={() => onAspectRatioChange(ar.value)}>
            {ar.label}
          </PillBtn>
        ))}
      </SettingPillGroup>

      <SettingPillGroup label={<><Clock className="h-3 w-3" /> Dur</>}>
        {DURATIONS.map(d => (
          <PillBtn key={d} active={duration === d} onClick={() => onDurationChange(d)}>
            {d}s
          </PillBtn>
        ))}
      </SettingPillGroup>
    </div>
  );
}
