'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { FrameSlot, FrameImage } from './FrameSlot';

interface KeyframeInputProps {
  startFrame: FrameImage | null;
  endFrame: FrameImage | null;
  onStartFrameChange: (img: FrameImage | null) => void;
  onEndFrameChange: (img: FrameImage | null) => void;
}

export function KeyframeInput({ startFrame, endFrame, onStartFrameChange, onEndFrameChange }: KeyframeInputProps) {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    frameType: 'first_frame' | 'last_frame',
    current: FrameImage | null,
    setter: (img: FrameImage | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (current) URL.revokeObjectURL(current.preview);
    setter({ file, preview: URL.createObjectURL(file), frameType });
    e.target.value = '';
  };

  return (
    <motion.div
      key="keyframe"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
    >
      <div className="grid grid-cols-2 gap-3">
        <FrameSlot
          label="Start Frame"
          subtitle="Animate an image"
          image={startFrame}
          onUpload={() => startRef.current?.click()}
          onRemove={() => { if (startFrame) URL.revokeObjectURL(startFrame.preview); onStartFrameChange(null); }}
        />
        <input ref={startRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e, 'first_frame', startFrame, onStartFrameChange)} />

        <FrameSlot
          label="End Frame"
          subtitle="How video ends"
          optional
          image={endFrame}
          onUpload={() => endRef.current?.click()}
          onRemove={() => { if (endFrame) URL.revokeObjectURL(endFrame.preview); onEndFrameChange(null); }}
        />
        <input ref={endRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e, 'last_frame', endFrame, onEndFrameChange)} />
      </div>
    </motion.div>
  );
}
