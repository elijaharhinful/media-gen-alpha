'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Sparkles,
  Film,
  Camera,
  Palette,
  Shield,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Analysis {
  extraction?: {
    who?: string;
    what?: string;
    where?: string;
    light?: string;
    feel?: string;
    arc?: string;
    length?: string;
  };
  architecture_chosen?: string;
  architecture_reason?: string;
  enhancements_applied?: string[];
  camera_strategy?: string;
  color_approach?: string;
  quality_tier?: string;
}

interface GenerationResult {
  enhanced_prompt?: string;
  analysis?: Analysis;
}

export function MultiplierTool() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!input?.trim?.()) {
      toast.error('Please enter a scene description');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResult(null);
    setError(null);
    setShowAnalysis(false);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneDescription: input }),
        signal: abortRef?.current?.signal,
      });

      if (!response?.ok) {
        const errData = await response?.json?.().catch(() => ({}));
        throw new Error(errData?.message ?? `HTTP ${response?.status}`);
      }

      const reader = response?.body?.getReader();
      if (!reader) throw new Error('Failed to read response stream');

      const decoder = new TextDecoder();
      let partialRead = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() ?? '';

        for (const line of lines) {
          if (line?.startsWith?.('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              if (parsed?.status === 'processing') {
                setProgress((prev: number) => Math.min((prev ?? 0) + 1, 99));
              } else if (parsed?.status === 'completed') {
                setResult(parsed?.result ?? null);
                setProgress(100);
                setIsGenerating(false);
                toast.success('Enhanced prompt generated!');
                return;
              } else if (parsed?.status === 'error') {
                throw new Error(parsed?.message ?? 'Generation failed');
              }
            } catch (e: any) {
              if (e?.message && e?.message !== 'Generation failed') {
                // Skip JSON parse errors from partial chunks
              } else if (e?.message) {
                throw e;
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Generation error:', err);
      setError(err?.message ?? 'An unexpected error occurred');
      toast.error(err?.message ?? 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [input]);

  const handleCopy = useCallback(async () => {
    const text = result?.enhanced_prompt ?? '';
    if (!text) return;
    try {
      // Try modern clipboard API first
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for iframe / insecure contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Final fallback: try execCommand even if clipboard API threw
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to copy — try selecting the text manually');
      }
    }
  }, [result]);

  const handleDownload = useCallback(() => {
    const text = result?.enhanced_prompt ?? '';
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced-prompt-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Prompt downloaded!');
  }, [result]);

  const analysis = result?.analysis;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Section */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border/50 bg-card p-6 shadow-md">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Film className="h-4 w-4 text-primary" />
            Scene Description
          </label>
          <textarea
            value={input ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e?.target?.value ?? '')}
            placeholder="Describe your scene idea... e.g., 'A mechanic fixing a car in a garage, looks cool and cinematic' or 'Two friends arguing about something dumb'"
            className="w-full min-h-[200px] rounded-lg border border-input bg-background p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            disabled={isGenerating}
          />
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">
              {(input?.length ?? 0)} characters
            </span>
            <motion.button
              onClick={handleGenerate}
              disabled={isGenerating || !(input?.trim?.())}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate Enhanced Prompt
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Progress Indicator */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium text-foreground">Applying Multiplier Framework...</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${Math.min(progress ?? 0, 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
                <span className="font-mono">{Math.min(progress ?? 0, 99)}%</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {['Extract', 'Select', 'Map', 'Amplify', 'Guard'].map((step: string, i: number) => (
                  <span
                    key={step}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      (progress ?? 0) > i * 20
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted/50 border-border/50 text-muted-foreground'
                    }`}
                  >
                    {step}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Example Inputs */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Try an example</p>
          <div className="space-y-2">
            {[
              'A mechanic fixing a car in a garage, looks cool and cinematic',
              'A woman walking to work in the morning in a city',
              'Two friends arguing about something dumb',
              'A parkour chase through a city',
              'Show off a luxury watch in a cool way',
            ].map((example: string) => (
              <button
                key={example}
                onClick={() => setInput(example)}
                disabled={isGenerating}
                className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/50 bg-background/50 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-50"
              >
                &ldquo;{example}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Output Section */}
      <div className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{error ?? 'Unknown error'}</span>
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Enhanced Prompt Output */}
            <div className="rounded-xl border border-border/50 bg-card p-6 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Enhanced Video Prompt
                </label>
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </motion.button>
                  <motion.button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </motion.button>
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border/30 bg-background p-4">
                <pre className="whitespace-pre-wrap text-sm font-mono text-foreground leading-relaxed">
                  {result?.enhanced_prompt ?? 'No prompt generated'}
                </pre>
              </div>
              {analysis?.architecture_chosen && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Camera className="h-3 w-3" />
                    {analysis?.architecture_chosen ?? ''}
                  </span>
                  {analysis?.color_approach && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground">
                      <Palette className="h-3 w-3" />
                      {analysis?.color_approach ?? ''}
                    </span>
                  )}
                  {analysis?.quality_tier && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground">
                      <Shield className="h-3 w-3" />
                      {analysis?.quality_tier ?? ''} Quality
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Transformation Analysis Accordion */}
            <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <button
                onClick={() => setShowAnalysis((prev: boolean) => !prev)}
                className="w-full flex items-center justify-between p-4 text-sm font-semibold text-foreground hover:bg-accent/30 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  View Transformation Analysis
                </span>
                {showAnalysis ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <AnimatePresence>
                {showAnalysis && analysis && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 space-y-4">
                      {/* Step 1: Extraction */}
                      {analysis?.extraction && (
                        <div className="rounded-lg bg-background/50 p-4 border border-border/30">
                          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Step 1 — Extract</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(analysis?.extraction ?? {}).map(([key, val]: [string, any]) => (
                              <div key={key} className="text-xs">
                                <span className="font-semibold text-muted-foreground uppercase">{key ?? ''}: </span>
                                <span className="text-foreground">{val ?? 'N/A'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Step 2: Architecture */}
                      {analysis?.architecture_chosen && (
                        <div className="rounded-lg bg-background/50 p-4 border border-border/30">
                          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Step 2 — Select Architecture</h4>
                          <p className="text-sm font-medium text-foreground">{analysis?.architecture_chosen ?? ''}</p>
                          <p className="text-xs text-muted-foreground mt-1">{analysis?.architecture_reason ?? ''}</p>
                        </div>
                      )}

                      {/* Steps 3-4: Enhancements */}
                      {(analysis?.enhancements_applied?.length ?? 0) > 0 && (
                        <div className="rounded-lg bg-background/50 p-4 border border-border/30">
                          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Steps 3–4 — Map & Amplify</h4>
                          <ul className="space-y-1">
                            {(analysis?.enhancements_applied ?? []).map((e: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                <span className="text-primary mt-0.5">✓</span>
                                {e ?? ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Step 5: Technical Specs */}
                      {(analysis?.camera_strategy || analysis?.color_approach) && (
                        <div className="rounded-lg bg-background/50 p-4 border border-border/30">
                          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Step 5 — Guard & Polish</h4>
                          {analysis?.camera_strategy && (
                            <p className="text-xs text-foreground mb-1">
                              <span className="font-semibold text-muted-foreground">Camera: </span>
                              {analysis?.camera_strategy ?? ''}
                            </p>
                          )}
                          {analysis?.color_approach && (
                            <p className="text-xs text-foreground">
                              <span className="font-semibold text-muted-foreground">Color: </span>
                              {analysis?.color_approach ?? ''}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!result && !isGenerating && !error && (
          <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center shadow-sm">
            <Wand2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Enter a scene description and click Generate to see the enhanced prompt appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
