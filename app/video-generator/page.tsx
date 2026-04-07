'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Film, Sparkles, Loader2, Upload, X, Clock, Monitor, Ratio,
  ImageIcon, Play, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Image from 'next/image';

const resolutions = [
  { value: '720p', label: '720p', desc: 'HD' },
  { value: '1080p', label: '1080p', desc: 'Full HD' },
];

const aspectRatios = [
  { value: '16:9', label: '16:9', desc: 'Landscape' },
  { value: '9:16', label: '9:16', desc: 'Portrait' },
  { value: '1:1', label: '1:1', desc: 'Square' },
];

const durations = [
  { value: '5s', label: '5s' },
  { value: '10s', label: '10s' },
];

interface RefImage {
  file: File;
  preview: string;
}

export default function VideoGeneratorPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('720p');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState('5s');
  const [refImages, setRefImages] = useState<RefImage[]>([]);
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
        .catch(() => {});
    }
  }, [status]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > 3) {
      toast.error('Maximum 3 reference images allowed');
      return;
    }
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setRefImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeRefImage = (index: number) => {
    setRefImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadRefImages = async (): Promise<string[]> => {
    const paths: string[] = [];
    for (const img of refImages) {
      try {
        const presignRes = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: img.file.name,
            contentType: img.file.type,
            isPublic: true,
          }),
        });
        const { uploadUrl, cloud_storage_path } = await presignRes.json();

        // Check signed headers
        const url = new URL(uploadUrl);
        const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders') || '';
        const headers: Record<string, string> = { 'Content-Type': img.file.type };
        if (signedHeaders.includes('content-disposition')) {
          headers['Content-Disposition'] = 'attachment';
        }

        await fetch(uploadUrl, {
          method: 'PUT',
          headers,
          body: img.file,
        });

        paths.push(cloud_storage_path);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    return paths;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      let refPaths: string[] = [];
      if (refImages.length > 0) {
        refPaths = await uploadRefImages();
      }

      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          referenceImages: refPaths,
          resolution,
          aspectRatio,
          duration,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Generation failed');
        setLoading(false);
        return;
      }

      setResult(data);
      if (data.status === 'completed') {
        toast.success('Video generated!');
      } else if (data.status === 'processing') {
        toast.info('Video is being processed...');
      } else {
        toast.info(data.message || 'Request saved');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || status === 'unauthenticated') {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="hero-gradient-purple">
      <section className="pt-12 pb-6 px-4">
        <div className="mx-auto max-w-[1000px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-1.5 text-sm text-purple-400 mb-4">
            <Film className="h-3.5 w-3.5" /> AI Powered
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Video <span className="text-purple-400">Generator</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Create cinematic videos with reference images, professional prompts, and advanced controls.
          </p>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="mx-auto max-w-[1000px]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-6">
            {/* Input Panel */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
                <label className="block text-sm font-medium mb-2">Video Prompt</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe your cinematic video scene in detail..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  maxLength={4000}
                />

                {/* Reference Images */}
                <div className="mt-4">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                    <ImageIcon className="h-3.5 w-3.5" /> Reference Images ({refImages.length}/3)
                  </label>
                  <div className="flex gap-3 items-start">
                    {refImages.map((img, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/50 bg-muted">
                        <Image src={img.preview} alt={`Reference ${i + 1}`} fill className="object-cover" />
                        <button
                          onClick={() => removeRefImage(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {refImages.length < 3 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-purple-400/30 transition-colors"
                      >
                        <Upload className="h-4 w-4 mb-1" />
                        <span className="text-[10px]">Upload</span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Monitor className="h-3.5 w-3.5" /> Resolution
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {resolutions.map(r => (
                        <button
                          key={r.value}
                          onClick={() => setResolution(r.value)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            resolution === r.value
                              ? 'border-purple-400/50 bg-purple-400/10 text-purple-400'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Ratio className="h-3.5 w-3.5" /> Aspect
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {aspectRatios.map(ar => (
                        <button
                          key={ar.value}
                          onClick={() => setAspectRatio(ar.value)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            aspectRatio === ar.value
                              ? 'border-purple-400/50 bg-purple-400/10 text-purple-400'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {ar.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Clock className="h-3.5 w-3.5" /> Duration
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {durations.map(d => (
                        <button
                          key={d.value}
                          onClick={() => setDuration(d.value)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            duration === d.value
                              ? 'border-purple-400/50 bg-purple-400/10 text-purple-400'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-400 to-violet-500 px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Generate Video</>
                  )}
                </button>
              </div>
            </div>

            {/* Result Panel */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 min-h-[300px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <Loader2 className="h-10 w-10 text-purple-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Creating your video...</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full text-center"
                    >
                      {result.videoUrl ? (
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                          <video
                            src={result.videoUrl}
                            controls
                            className="w-full h-full object-cover"
                            poster=""
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border/50 bg-background/50 p-8">
                          {result.status === 'processing' ? (
                            <>
                              <Loader2 className="h-8 w-8 text-purple-400 animate-spin mx-auto mb-3" />
                              <p className="text-sm font-medium mb-1">Video Processing</p>
                              <p className="text-xs text-muted-foreground">Your video is being generated. This may take a few minutes.</p>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
                              <p className="text-sm font-medium mb-1">Configuration Required</p>
                              <p className="text-xs text-muted-foreground">{result.message}</p>
                            </>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{result.prompt}</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center"
                    >
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
                          {vid.status === 'completed' ? <Play className="h-3.5 w-3.5 text-purple-400" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{vid.prompt}</p>
                          <p className="text-[10px] text-muted-foreground">{vid.resolution} • {vid.aspectRatio} • {vid.duration}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          vid.status === 'completed' ? 'bg-green-400/10 text-green-400' :
                          vid.status === 'processing' ? 'bg-amber-400/10 text-amber-400' :
                          vid.status === 'failed' ? 'bg-red-400/10 text-red-400' :
                          'bg-blue-400/10 text-blue-400'
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
