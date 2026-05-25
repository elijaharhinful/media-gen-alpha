'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ImageIcon, Sparkles, Download, Loader2, Clock, Ratio, Palette, Upload, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';

const styles = [
  { value: '', label: 'Default' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: 'oil painting', label: 'Oil Painting' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'digital art', label: 'Digital Art' },
  { value: '3d render', label: '3D Render' },
  { value: 'pixel art', label: 'Pixel Art' },
];

const aspectRatios = [
  { value: '1:1', label: '1:1', desc: 'Square' },
  { value: '2:3', label: '2:3', desc: 'Portrait' },
  { value: '3:2', label: '3:2', desc: 'Landscape' },
  { value: '4:3', label: '4:3', desc: 'Classic' },
  { value: '3:4', label: '3:4', desc: 'Classic' },
  { value: '4:5', label: '4:5', desc: 'Portrait'},
  { value: '5:4', label: '5:4', desc: 'Landscape'},
  { value: '16:9', label: '16:9', desc: 'Landscape' },
  { value: '9:16', label: '9:16', desc: 'Portrait' },
];

const examplePrompts = [
  'A serene Japanese garden with cherry blossoms falling into a koi pond at golden hour',
  'Cyberpunk city street at night with neon reflections on wet pavement',
  'An astronaut floating above Earth, reflected in the helmet visor',
];

interface GeneratedImageResult {
  id: string;
  imageUrl: string;
  prompt: string;
  style?: string;
  aspectRatio?: string;
  status?: string;
}

interface RefImage {
  id: string;
  file: File;
  preview: string;
}

export default function ImageGeneratorPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [model, setModel] = useState<'model1' | 'model2'>('model1');
  const [draggedImgIdx, setDraggedImgIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [result, setResult] = useState<GeneratedImageResult | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    const initData = sessionStorage.getItem('img-gen-init');
    if (initData) {
      setIsRestoring(true);
      try {
        const parsed = JSON.parse(initData);
        if (parsed.prompt) setPrompt(parsed.prompt);
        if (parsed.style) setStyle(parsed.style);
        if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
        if (parsed.model) setModel(parsed.model);
        
        if (parsed.referenceImages && parsed.referenceImages.length > 0) {
          const loadRefs = async () => {
            const loaded: RefImage[] = [];
            for (const url of parsed.referenceImages) {
              try {
                const fullUrl = url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_R2_URL || ''}/${url}`;
                const res = await fetch(fullUrl);
                const blob = await res.blob();
                const filename = url.split('/').pop() || 'reference.jpg';
                const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
                loaded.push({
                  id: crypto.randomUUID(),
                  file,
                  preview: URL.createObjectURL(file),
                });
              } catch(e) {
                console.error("Failed to load reference image", e);
              }
            }
            setRefImages(prev => [...prev, ...loaded]);
            setIsRestoring(false);
          };
          loadRefs();
        } else {
          setIsRestoring(false);
        }
      } catch (e) {
        console.error("Failed to parse init data", e);
        setIsRestoring(false);
      }
      sessionStorage.removeItem('img-gen-init');
    }
  }, []);

  const { data: historyData, mutate: mutateHistory } = useSWR(
    status === 'authenticated' ? '/api/images/history?limit=3' : null,
    (url: string) => fetch(url).then(r => r.json())
  );
  
  const history: GeneratedImageResult[] = historyData?.images || [];

  // Poll for active image generation result
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (result?.id && result?.status === 'processing') {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/images/${result.id}/sync`, {
            method: 'POST',
          });
          if (!res.ok) return;

          const data = await res.json();
          if (data.status === 'completed' || data.status === 'failed') {
            setResult((prev: any) => ({ ...prev, ...data }));
            mutateHistory();
            clearInterval(intervalId);

            if (data.status === 'completed') {
              toast.success('Image generation complete!');
            } else if (data.status === 'failed') {
              toast.error('Image generation failed.');
            }
          }
        } catch (error) {
          console.error('Polling sync error:', error);
        }
      }, 4000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [result?.id, result?.status, mutateHistory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (refImages.length + files.length > 10) {
      toast.error('Maximum 10 reference images allowed');
      return;
    }
    const newImages = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setRefImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedImgIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedImgIdx === null || draggedImgIdx === idx) return;
    setRefImages(prev => {
      const newRefs = [...prev];
      const [removed] = newRefs.splice(draggedImgIdx, 1);
      newRefs.splice(idx, 0, removed);
      return newRefs;
    });
    setDraggedImgIdx(null);
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
    setImgError(false);

    try {
      let refPaths: string[] = [];
      if (refImages.length > 0) {
        refPaths = await uploadRefImages();
      }

      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style,
          aspectRatio,
          referenceImages: refPaths,
          model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Generation failed');
        return;
      }

      setResult(data);
      mutateHistory();

      if (data.status === 'processing') {
        toast.info('Image generation in progress. You can monitor it in the Tasks menu.');
      } else if (data.imageUrl) {
        toast.success('Image generated!');
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
    <div className="hero-gradient-green">
      <section className="pt-12 pb-6 px-4">
        <div className="mx-auto max-w-[1000px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/10 px-4 py-1.5 text-sm text-lime-400 mb-4">
            <ImageIcon className="h-3.5 w-3.5" /> Seedream 3
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Image <span className="text-lime-400">Generator</span>
          </h1>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="mx-auto max-w-[1000px]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6 relative">
            {isRestoring && (
              <div className="absolute inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                <div className="flex flex-col items-center gap-3 bg-card p-6 rounded-xl shadow-lg border border-border/50 text-center">
                  <Loader2 className="h-8 w-8 text-lime-400 animate-spin mx-auto" />
                  <p className="text-sm font-medium">Restoring generator state...</p>
                  <p className="text-xs text-muted-foreground">Downloading references</p>
                </div>
              </div>
            )}
            {/* Input Panel */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
                <label className="block text-sm font-medium mb-2">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to create..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                  maxLength={2000}
                />

                {/* Reference Images */}
                <div className="mt-4">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                    <ImageIcon className="h-3.5 w-3.5" /> Reference Images ({refImages.length}/10)
                  </label>
                  <div className="flex flex-wrap gap-3 items-start">
                    {refImages.map((img, i) => (
                      <div 
                        key={img.id} 
                        className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/50 bg-muted cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => handleDragStart(e, i)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, i)}
                      >
                        <Image src={img.preview} alt={`Reference ${i + 1}`} fill className="object-cover pointer-events-none" />
                        <button
                          onClick={() => removeRefImage(i)}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {refImages.length < 10 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-lime-400/30 transition-colors"
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

                {/* Model Selection Switcher */}
                <div className="mt-4">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                    <Sparkles className="h-3.5 w-3.5" /> Image Model
                  </label>
                  <div className="relative flex rounded-xl border border-border bg-background p-1 w-full">
                    <button
                      type="button"
                      onClick={() => setModel('model1')}
                      className={`relative flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 z-10 ${
                        model === 'model1' ? 'text-lime-400' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {model === 'model1' && (
                        <motion.div
                          layoutId="activeModelIndicator"
                          className="absolute inset-0 rounded-lg bg-lime-400/10 border border-lime-400/20 shadow-[0_0_12px_rgba(163,230,53,0.15)] z-[-1]"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span>Model 1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModel('model2')}
                      className={`relative flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 z-10 ${
                        model === 'model2' ? 'text-lime-400' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {model === 'model2' && (
                        <motion.div
                          layoutId="activeModelIndicator"
                          className="absolute inset-0 rounded-lg bg-lime-400/10 border border-lime-400/20 shadow-[0_0_12px_rgba(163,230,53,0.15)] z-[-1]"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span>Model 2</span>
                    </button>
                  </div>
                </div>
 
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Palette className="h-3.5 w-3.5" /> Style
                    </label>
                    <select
                      value={style}
                      onChange={e => setStyle(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                    >
                      {styles.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                      <Ratio className="h-3.5 w-3.5" /> Aspect Ratio
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {aspectRatios.map(ar => (
                        <button
                          key={ar.value}
                          onClick={() => setAspectRatio(ar.value)}
                          className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                            aspectRatio === ar.value
                              ? 'border-lime-400/50 bg-lime-400/10 text-lime-400'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {ar.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lime-400 to-green-500 px-4 py-3 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Generate Image</>
                  )}
                </button>
              </div>

              {/* Example Prompts */}
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Try an example:</p>
                <div className="flex flex-col gap-2">
                  {examplePrompts.map((ep, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(ep)}
                      className="text-left text-xs text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 bg-background/50 border border-border/30 hover:border-border transition-colors line-clamp-1"
                    >
                      {ep}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Result Panel */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 min-h-[300px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {loading || result?.status === 'processing' ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center"
                    >
                      <Loader2 className="h-10 w-10 text-lime-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Creating your image...</p>
                    </motion.div>
                  ) : result?.status === 'failed' ? (
                    <motion.div
                      key="failed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center"
                    >
                      <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" style={{ color: '#F87171' }} />
                      <p className="text-sm text-muted-foreground">Image generation failed.</p>
                    </motion.div>
                  ) : result?.imageUrl && result?.status === 'completed' && !imgError ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-full"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                        <Image
                          src={result.imageUrl}
                          alt={result.prompt}
                          fill
                          className="object-cover"
                          onError={() => setImgError(true)}
                          unoptimized
                        />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <a
                          href={result.imageUrl}
                          download={`image-${result.id}.png`}
                          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center"
                    >
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Your generated image will appear here</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Recent History */}
              {history.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Recent
                    </p>
                    <Link
                      href="/library?type=images"
                      className="flex items-center gap-1 text-xs text-lime-400 hover:text-lime-300 transition-colors font-medium"
                    >
                      View all <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {history.filter(h => h.imageUrl).slice(0, 3).map(img => (
                      <button
                        key={img.id}
                        onClick={() => { setResult(img); setImgError(false); }}
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border/30 hover:border-lime-400/30 transition-colors"
                      >
                        <Image
                          src={img.imageUrl}
                          alt={img.prompt}
                          fill
                          className="object-cover"
                          unoptimized
                        />
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
