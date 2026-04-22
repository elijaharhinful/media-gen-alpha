'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ImageIcon, Video, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { RefSection, ImageRefThumb, MediaChip, AddThumb } from './RefMedia';

export interface MediaRef {
  file: File;
  name: string;
  preview?: string;
}

interface ReferenceInputProps {
  refImages: MediaRef[];
  refVideos: MediaRef[];
  refAudios: MediaRef[];
  onImagesChange: (imgs: MediaRef[]) => void;
  onVideosChange: (vids: MediaRef[]) => void;
  onAudiosChange: (auds: MediaRef[]) => void;
}

export function ReferenceInput({
  refImages, refVideos, refAudios,
  onImagesChange, onVideosChange, onAudiosChange,
}: ReferenceInputProps) {
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const audRef = useRef<HTMLInputElement>(null);

  const addImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > 9) { toast.error('Maximum 9 reference images'); return; }
    onImagesChange([...refImages, ...files.map(f => ({ file: f, name: f.name, preview: URL.createObjectURL(f) }))]);
    e.target.value = '';
  };

  const addVideos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refVideos.length + files.length > 3) { toast.error('Maximum 3 reference videos'); return; }
    onVideosChange([...refVideos, ...files.map(f => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const addAudios = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refAudios.length + files.length > 3) { toast.error('Maximum 3 reference audio files'); return; }
    if (refImages.length === 0 && refVideos.length === 0) toast.warning('Audio refs require at least one image or video ref');
    onAudiosChange([...refAudios, ...files.map(f => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const removeImage = (i: number) => {
    if (refImages[i].preview) URL.revokeObjectURL(refImages[i].preview!);
    onImagesChange(refImages.filter((_, idx) => idx !== i));
  };

  const hasRefs = refImages.length > 0 || refVideos.length > 0 || refAudios.length > 0;

  return (
    <motion.div
      key="reference"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="space-y-2"
    >
      {/* Image Ref */}
      <RefSection
        icon={<ImageIcon className="h-3.5 w-3.5" />}
        label={`Image Ref (${refImages.length}/9)`}
        onAdd={() => imgRef.current?.click()}
        canAdd={refImages.length < 9}
        hint="Use @image1, @image2… in your prompt"
      >
        {refImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {refImages.map((img, i) => (
              <ImageRefThumb key={i} preview={img.preview!} index={i + 1} onRemove={() => removeImage(i)} />
            ))}
            {refImages.length < 9 && <AddThumb onClick={() => imgRef.current?.click()} />}
          </div>
        )}
      </RefSection>
      <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={addImages} />

      {/* Video + Audio side by side */}
      <div className="grid grid-cols-2 gap-2">
        <RefSection
          icon={<Video className="h-3.5 w-3.5" />}
          label={`Video Ref (${refVideos.length}/3)`}
          sublabel="0/15s"
          onAdd={() => vidRef.current?.click()}
          canAdd={refVideos.length < 3}
          hint="MP4/MOV ≤15s"
        >
          {refVideos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {refVideos.map((v, i) => (
                <MediaChip key={i} name={v.name} index={i + 1} icon={<Video className="h-3 w-3" />}
                  onRemove={() => onVideosChange(refVideos.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          )}
        </RefSection>

        <RefSection
          icon={<Volume2 className="h-3.5 w-3.5" />}
          label={`Audio Ref (${refAudios.length}/3)`}
          sublabel="0/15s"
          onAdd={() => audRef.current?.click()}
          canAdd={refAudios.length < 3}
          hint="MP3/WAV ≤15s"
        >
          {refAudios.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {refAudios.map((a, i) => (
                <MediaChip key={i} name={a.name} index={i + 1} icon={<Volume2 className="h-3 w-3" />}
                  onRemove={() => onAudiosChange(refAudios.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          )}
        </RefSection>
      </div>
      <input ref={vidRef} type="file" accept="video/mp4,video/quicktime" multiple className="hidden" onChange={addVideos} />
      <input ref={audRef} type="file" accept="audio/mpeg,audio/wav,audio/mp3" multiple className="hidden" onChange={addAudios} />

      {hasRefs && (
        <p className="text-[10px] text-muted-foreground/60 pt-1">
          Reference media in your prompt using{' '}
          <span className="font-mono text-purple-400/80">@image1</span>,{' '}
          <span className="font-mono text-purple-400/80">@video1</span>,{' '}
          <span className="font-mono text-purple-400/80">@audio1</span> etc.
        </p>
      )}
    </motion.div>
  );
}
