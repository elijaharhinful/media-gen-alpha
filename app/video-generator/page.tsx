'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Film, Sparkles, Loader2, Upload, X, Clock, Monitor, Ratio,
  ImageIcon, Play, AlertCircle, Clapperboard, Layers, Volume2, Video,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Image from 'next/image';

const resolutions = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
];

const aspectRatios = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '21:9', label: '21:9' },
  { value: '9:21', label: '9:21' },
];

const durations = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

type InputMode = 'keyframe' | 'reference';

interface FrameImage {
  file: File;
  preview: string;
  frameType: 'first_frame' | 'last_frame';
}

interface MediaRef {
  file: File;
  name: string;
  preview?: string; // only for images
}

export default function VideoGeneratorPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  const startFrameRef = useRef<HTMLInputElement>(null);
  const endFrameRef = useRef<HTMLInputElement>(null);
  const imgRefInput = useRef<HTMLInputElement>(null);
  const vidRefInput = useRef<HTMLInputElement>(null);
  const audRefInput = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('keyframe');
  const [resolution, setResolution] = useState('720p');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(5);

  // Keyframe mode
  const [startFrame, setStartFrame] = useState<FrameImage | null>(null);
  const [endFrame, setEndFrame] = useState<FrameImage | null>(null);

  // Reference mode
  const [refImages, setRefImages] = useState<MediaRef[]>([]);
  const [refVideos, setRefVideos] = useState<MediaRef[]>([]);
  const [refAudios, setRefAudios] = useState<MediaRef[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/videos/history?limit=5')
        .then(r => r.json())
        .then(d => setHistory(d.videos || []))
        .catch(() => { });
    }
  }, [status]);

  // ── file helpers ──────────────────────────────────────────────────────────

  const handleFrameFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    frameType: 'first_frame' | 'last_frame',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img: FrameImage = { file, preview: URL.createObjectURL(file), frameType };
    if (frameType === 'first_frame') {
      if (startFrame) URL.revokeObjectURL(startFrame.preview);
      setStartFrame(img);
    } else {
      if (endFrame) URL.revokeObjectURL(endFrame.preview);
      setEndFrame(img);
    }
    e.target.value = '';
  };

  const addRefImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > 9) {
      toast.error('Maximum 9 reference images');
      return;
    }
    setRefImages(prev => [
      ...prev,
      ...files.map(f => ({ file: f, name: f.name, preview: URL.createObjectURL(f) })),
    ]);
    e.target.value = '';
  };

  const addRefVideos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refVideos.length + files.length > 3) {
      toast.error('Maximum 3 reference videos');
      return;
    }
    setRefVideos(prev => [...prev, ...files.map(f => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const addRefAudios = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refAudios.length + files.length > 3) {
      toast.error('Maximum 3 reference audio files');
      return;
    }
    // Validate: audio requires at least one image or video ref
    if (refImages.length === 0 && refVideos.length === 0 && files.length > 0) {
      toast.warning('Audio refs require at least one image or video ref');
    }
    setRefAudios(prev => [...prev, ...files.map(f => ({ file: f, name: f.name }))]);
    e.target.value = '';
  };

  const removeRefImage = (i: number) => {
    setRefImages(prev => {
      if (prev[i].preview) URL.revokeObjectURL(prev[i].preview!);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  // ── upload helper ─────────────────────────────────────────────────────────

  const uploadFile = async (file: File): Promise<string> => {
    const presignRes = await fetch('/api/upload/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, isPublic: true }),
    });
    const { uploadUrl, cloud_storage_path } = await presignRes.json();

    const url = new URL(uploadUrl);
    const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders') || '';
    const headers: Record<string, string> = { 'Content-Type': file.type };
    if (signedHeaders.includes('content-disposition')) {
      headers['Content-Disposition'] = 'attachment';
    }
    await fetch(uploadUrl, { method: 'PUT', headers, body: file });
    return cloud_storage_path;
  };

  // ── generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // Guard: audio without image/video ref
    if (inputMode === 'reference' && refAudios.length > 0 && refImages.length === 0 && refVideos.length === 0) {
      toast.error('Audio refs require at least one image or video ref');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        prompt,
        inputMode,
        resolution,
        aspectRatio,
        duration,
      };

      if (inputMode === 'keyframe') {
        if (startFrame) payload.startFrameUrl = await uploadFile(startFrame.file);
        if (endFrame) payload.endFrameUrl = await uploadFile(endFrame.file);
      } else {
        // Upload all three ref types in parallel
        const [imgPaths, vidPaths, audPaths] = await Promise.all([
          Promise.all(refImages.map(r => uploadFile(r.file))),
          Promise.all(refVideos.map(r => uploadFile(r.file))),
          Promise.all(refAudios.map(r => uploadFile(r.file))),
        ]);
        if (imgPaths.length) payload.referenceImages = imgPaths;
        if (vidPaths.length) payload.referenceVideos = vidPaths;
        if (audPaths.length) payload.referenceAudios = audPaths;
      }

      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Generation failed');
        return;
      }

      setResult(data);
      if (data.status === 'completed') toast.success('Video generated!');
      else if (data.status === 'processing') toast.info('Video is being processed...');
      else toast.info(data.message || 'Request saved');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const hasRefs = refImages.length > 0 || refVideos.length > 0 || refAudios.length > 0;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="hero-gradient-purple">
      <section className="pt-12 pb-6 px-4">
        <div className="mx-auto max-w-[960px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-1.5 text-sm text-purple-400 mb-4">
            <Film className="h-3.5 w-3.5" /> Powered by Seedance 2.0
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Video <span className="text-purple-400">Generator</span>
          </h1>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="mx-auto max-w-[960px]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6">

            {/* ── INPUT PANEL ── */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">

                {/* Mode tabs */}
                <div className="flex border-b border-border/50">
                  <ModeTab
                    active={inputMode === 'keyframe'}
                    onClick={() => setInputMode('keyframe')}
                    icon={<Clapperboard className="h-3.5 w-3.5" />}
                    label="Keyframe"
                  />
                  <ModeTab
                    active={inputMode === 'reference'}
                    onClick={() => setInputMode('reference')}
                    icon={<Layers className="h-3.5 w-3.5" />}
                    label="Reference"
                  />
                </div>

                <div className="p-5 space-y-4">
                  <AnimatePresence mode="wait">

                    {/* ── KEYFRAME MODE ── */}
                    {inputMode === 'keyframe' && (
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
                            onUpload={() => startFrameRef.current?.click()}
                            onRemove={() => { if (startFrame) URL.revokeObjectURL(startFrame.preview); setStartFrame(null); }}
                          />
                          <input ref={startFrameRef} type="file" accept="image/*" className="hidden"
                            onChange={e => handleFrameFile(e, 'first_frame')} />

                          <FrameSlot
                            label="End Frame"
                            subtitle="How video ends"
                            optional
                            image={endFrame}
                            onUpload={() => endFrameRef.current?.click()}
                            onRemove={() => { if (endFrame) URL.revokeObjectURL(endFrame.preview); setEndFrame(null); }}
                          />
                          <input ref={endFrameRef} type="file" accept="image/*" className="hidden"
                            onChange={e => handleFrameFile(e, 'last_frame')} />
                        </div>
                      </motion.div>
                    )}

                    {/* ── REFERENCE MODE ── */}
                    {inputMode === 'reference' && (
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
                          onAdd={() => imgRefInput.current?.click()}
                          canAdd={refImages.length < 9}
                          hint="Use @image1, @image2… in your prompt"
                        >
                          {refImages.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {refImages.map((img, i) => (
                                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border/50">
                                  <Image src={img.preview!} alt="" fill className="object-cover" />
                                  <RemoveBtn onClick={() => removeRefImage(i)} />
                                </div>
                              ))}
                              {refImages.length < 9 && (
                                <AddThumb onClick={() => imgRefInput.current?.click()} />
                              )}
                            </div>
                          )}
                        </RefSection>
                        <input ref={imgRefInput} type="file" accept="image/*" multiple className="hidden" onChange={addRefImages} />

                        {/* Video Ref */}
                        <RefSection
                          icon={<Video className="h-3.5 w-3.5" />}
                          label={`Video Ref (${refVideos.length}/3)`}
                          sublabel="0/15s"
                          onAdd={() => vidRefInput.current?.click()}
                          canAdd={refVideos.length < 3}
                          hint="Use @video1, @video2… in your prompt · MP4/MOV ≤15s"
                        >
                          {refVideos.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {refVideos.map((v, i) => (
                                <MediaChip
                                  key={i}
                                  name={v.name}
                                  icon={<Video className="h-3 w-3" />}
                                  onRemove={() => setRefVideos(prev => prev.filter((_, idx) => idx !== i))}
                                />
                              ))}
                            </div>
                          )}
                        </RefSection>
                        <input ref={vidRefInput} type="file" accept="video/mp4,video/quicktime" multiple className="hidden" onChange={addRefVideos} />

                        {/* Audio Ref */}
                        <RefSection
                          icon={<Volume2 className="h-3.5 w-3.5" />}
                          label={`Audio Ref (${refAudios.length}/3)`}
                          sublabel="0/15s"
                          onAdd={() => audRefInput.current?.click()}
                          canAdd={refAudios.length < 3}
                          hint="Use @audio1, @audio2… in your prompt · MP3/WAV ≤15s · requires image or video ref"
                        >
                          {refAudios.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {refAudios.map((a, i) => (
                                <MediaChip
                                  key={i}
                                  name={a.name}
                                  icon={<Volume2 className="h-3 w-3" />}
                                  onRemove={() => setRefAudios(prev => prev.filter((_, idx) => idx !== i))}
                                />
                              ))}
                            </div>
                          )}
                        </RefSection>
                        <input ref={audRefInput} type="file" accept="audio/mpeg,audio/wav,audio/mp3" multiple className="hidden" onChange={addRefAudios} />

                        {/* @-syntax hint */}
                        {hasRefs && (
                          <p className="text-[10px] text-muted-foreground/60 pt-1">
                            Reference media in your prompt using <span className="font-mono text-purple-400/80">@image1</span>, <span className="font-mono text-purple-400/80">@video1</span>, <span className="font-mono text-purple-400/80">@audio1</span> etc.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Prompt */}
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe the video you want to generate..."
                    className="w-full rounded-xl border border-border bg-background/60 px-4 py-3 text-sm min-h-[110px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/40 placeholder:text-muted-foreground/50"
                    maxLength={4000}
                  />

                  {/* Settings */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                    <SettingPillGroup label={<><Monitor className="h-3 w-3" /> Res</>}>
                      {resolutions.map(r => (
                        <PillBtn key={r.value} active={resolution === r.value} onClick={() => setResolution(r.value)}>
                          {r.label}
                        </PillBtn>
                      ))}
                    </SettingPillGroup>

                    <SettingPillGroup label={<><Ratio className="h-3 w-3" /> Aspect</>}>
                      {aspectRatios.map(ar => (
                        <PillBtn key={ar.value} active={aspectRatio === ar.value} onClick={() => setAspectRatio(ar.value)}>
                          {ar.label}
                        </PillBtn>
                      ))}
                    </SettingPillGroup>

                    <SettingPillGroup label={<><Clock className="h-3 w-3" /> Dur</>}>
                      {durations.map(d => (
                        <PillBtn key={d} active={duration === d} onClick={() => setDuration(d)}>
                          {d}s
                        </PillBtn>
                      ))}
                    </SettingPillGroup>
                  </div>

                  {/* Generate */}
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Generate</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ── RESULT PANEL ── */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 min-h-[300px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                      <Loader2 className="h-10 w-10 text-purple-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Creating your video...</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">This may take a few minutes</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
                      {result.videoUrl ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                          <video src={result.videoUrl} controls className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border/50 bg-background/50 p-8 text-center">
                          {result.status === 'processing' ? (
                            <>
                              <Loader2 className="h-8 w-8 text-purple-400 animate-spin mx-auto mb-3" />
                              <p className="text-sm font-medium mb-1">Video Processing</p>
                              <p className="text-xs text-muted-foreground">Your video is being generated. This may take a few minutes.</p>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                              <p className="text-sm font-medium mb-1">Generation Failed</p>
                              <p className="text-xs text-muted-foreground">{result.message}</p>
                            </>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{result.prompt}</p>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                      <Film className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Your generated video will appear here</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Recent Videos */}
              {history.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Recent Videos
                  </p>
                  <div className="flex flex-col gap-2">
                    {history.slice(0, 5).map(vid => (
                      <button
                        key={vid.id}
                        onClick={() => setResult(vid)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 bg-background/50 border border-border/30 hover:border-purple-400/30 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded bg-purple-400/10 flex items-center justify-center flex-shrink-0">
                          {vid.status === 'completed'
                            ? <Play className="h-3.5 w-3.5 text-purple-400" />
                            : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{vid.prompt}</p>
                          <p className="text-[10px] text-muted-foreground">{vid.resolution} · {vid.aspectRatio} · {vid.duration}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          vid.status === 'completed' ? 'bg-green-400/10 text-green-400'
                          : vid.status === 'processing' ? 'bg-amber-400/10 text-amber-400'
                          : vid.status === 'failed' ? 'bg-red-400/10 text-red-400'
                          : 'bg-blue-400/10 text-blue-400'
                        }`}>
                          {vid.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ModeTab({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
        active ? 'border-purple-400 text-purple-400 bg-purple-400/5' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}{label}
    </button>
  );
}

function FrameSlot({ label, subtitle, optional = false, image, onUpload, onRemove }: {
  label: string; subtitle: string; optional?: boolean;
  image: FrameImage | null; onUpload: () => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-background/40 overflow-hidden">
      {image ? (
        <div className="relative aspect-video">
          <Image src={image.preview} alt={label} fill className="object-cover" />
          <button onClick={onRemove} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500 transition-colors">
            <X className="h-3 w-3 text-white" />
          </button>
        </div>
      ) : (
        <button onClick={onUpload} className="w-full aspect-video flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:bg-purple-400/5 transition-colors">
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

function RefSection({ icon, label, sublabel, onAdd, canAdd, hint, children }: {
  icon: React.ReactNode; label: string; sublabel?: string;
  onAdd: () => void; canAdd: boolean; hint?: string; children?: React.ReactNode;
}) {
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

function MediaChip({ name, icon, onRemove }: {
  name: string; icon: React.ReactNode; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-purple-400/10 border border-purple-400/20 px-2 py-1">
      <span className="text-purple-400">{icon}</span>
      <span className="text-[10px] text-purple-300 max-w-[80px] truncate">{name}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-red-400 transition-colors ml-0.5">
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

function AddThumb({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-14 h-14 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center text-muted-foreground hover:border-purple-400/40 hover:text-purple-400 transition-colors"
    >
      <Upload className="h-3.5 w-3.5" />
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-500 transition-colors"
    >
      <X className="h-2.5 w-2.5 text-white" />
    </button>
  );
}

function SettingPillGroup({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide min-w-fit">
        {label}
      </span>
      {children}
    </div>
  );
}

function PillBtn({ active, onClick, children }: {
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