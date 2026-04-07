'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface PromptRecord {
  id: string;
  originalInput: string;
  enhancedOutput: string;
  transformationAnalysis: string | null;
  architectureChosen: string | null;
  createdAt: string;
}

export function HistoryClient() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page ?? 1),
        limit: '10',
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/history?${params}`);
      const data = await res?.json?.() ?? {};
      setPrompts(data?.prompts ?? []);
      setTotalPages(data?.totalPages ?? 1);
    } catch (err: any) {
      console.error('Fetch history error:', err);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator?.clipboard?.writeText?.(text ?? '');
      setCopiedId(id);
      toast.success('Copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handleDownload = useCallback((text: string, id: string) => {
    const blob = new Blob([text ?? ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced-prompt-${id ?? 'unknown'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr ?? '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearch(e?.target?.value ?? '');
            setPage(1);
          }}
          placeholder="Search prompts..."
          className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i: number) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (prompts?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No prompts match your search.' : 'No prompts generated yet. Go to the Multiplier to create your first one!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(prompts ?? []).map((prompt: PromptRecord, index: number) => {
            const isExpanded = expandedId === prompt?.id;
            let analysis: any = null;
            try {
              analysis = prompt?.transformationAnalysis
                ? JSON.parse(prompt.transformationAnalysis)
                : null;
            } catch {
              analysis = null;
            }

            return (
              <motion.div
                key={prompt?.id ?? index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDate(prompt?.createdAt ?? '')}
                        </span>
                        {prompt?.architectureChosen && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Camera className="h-2.5 w-2.5" />
                            {prompt?.architectureChosen ?? ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        &ldquo;{prompt?.originalInput ?? ''}&rdquo;
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleCopy(prompt?.enhancedOutput ?? '', prompt?.id ?? '')}
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        title="Copy prompt"
                      >
                        {copiedId === prompt?.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDownload(prompt?.enhancedOutput ?? '', prompt?.id ?? '')}
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        title="Download as .txt"
                      >
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : (prompt?.id ?? null))}
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        title="Expand/collapse"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3">
                        <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                          <h5 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Enhanced Prompt</h5>
                          <pre className="whitespace-pre-wrap text-xs font-mono text-foreground leading-relaxed max-h-[300px] overflow-y-auto">
                            {prompt?.enhancedOutput ?? ''}
                          </pre>
                        </div>

                        {analysis && (
                          <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                            <h5 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Transformation Analysis</h5>
                            {analysis?.extraction && (
                              <div className="grid grid-cols-2 gap-1.5 mb-2">
                                {Object.entries(analysis?.extraction ?? {}).map(([key, val]: [string, any]) => (
                                  <div key={key} className="text-xs">
                                    <span className="font-semibold text-muted-foreground uppercase">{key}: </span>
                                    <span className="text-foreground">{val ?? 'N/A'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {analysis?.architecture_reason && (
                              <p className="text-xs text-muted-foreground">{analysis?.architecture_reason ?? ''}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p: number) => Math.max(1, (p ?? 1) - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <span className="text-sm text-muted-foreground font-mono">
            {page ?? 1} / {totalPages ?? 1}
          </span>
          <button
            onClick={() => setPage((p: number) => Math.min(totalPages ?? 1, (p ?? 1) + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
