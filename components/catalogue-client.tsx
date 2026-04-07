'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Film,
  User,
  Heart,
  MessageCircle,
  Tag,
  Filter,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Camera,
  Clock,
  Volume2,
  FileText,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface VideoEntry {
  id: string;
  linkId: number;
  url: string;
  platform: string;
  status: string;
  creator: string | null;
  caption: string | null;
  promptText: string | null;
  promptLocation: string | null;
  videoType: string | null;
  referenceImage: string | null;
  techniques: string[];
  keyInsights: string[];
  style: string | null;
  hasTimestamps: boolean;
  hasDialogue: boolean;
  hasCameraDir: boolean;
  hasSfx: boolean;
  likes: number | null;
  comments: number | null;
}

export function CatalogueClient() {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [hasPrompt, setHasPrompt] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ platforms: string[]; creators: string[]; styles: string[] }>({
    platforms: [],
    creators: [],
    styles: [],
  });

  const fetchCatalogue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (platform) params.set('platform', platform);
      if (hasPrompt) params.set('hasPrompt', 'true');

      const res = await fetch(`/api/catalogue?${params}`);
      const data = await res?.json?.() ?? {};
      setVideos(data?.videos ?? []);
      setFilters(data?.filters ?? { platforms: [], creators: [], styles: [] });
    } catch (err: any) {
      console.error('Fetch catalogue error:', err);
      toast.error('Failed to load catalogue');
    } finally {
      setLoading(false);
    }
  }, [search, platform, hasPrompt]);

  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator?.clipboard?.writeText?.(text ?? '');
      setCopiedId(id);
      toast.success('Prompt copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const formatNumber = (num: number | null) => {
    if (num == null) return null;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  const getPlatformColor = (p: string) => {
    if (p === 'Instagram') return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
    if (p === 'Reddit') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    return 'bg-muted text-muted-foreground border-border/50';
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e?.target?.value ?? '')}
            placeholder="Search by keyword, creator, or technique..."
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowFilters((p: boolean) => !p)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            showFilters || platform || hasPrompt
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-input bg-background text-muted-foreground hover:text-foreground'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {(platform || hasPrompt) && (
            <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {(platform ? 1 : 0) + (hasPrompt ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider self-center mr-2">Platform:</span>
                <button
                  onClick={() => setPlatform('')}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    !platform ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-border/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {(filters?.platforms ?? []).map((p: string) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(platform === p ? '' : p)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      platform === p ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background border-border/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p ?? ''}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPrompt}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHasPrompt(e?.target?.checked ?? false)}
                    className="rounded border-border"
                  />
                  <span className="text-muted-foreground">Only show entries with full prompts</span>
                </label>
              </div>
              {(platform || hasPrompt) && (
                <button
                  onClick={() => {
                    setPlatform('');
                    setHasPrompt(false);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <X className="h-3 w-3" />
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Count */}
      <p className="text-xs text-muted-foreground">
        Showing {videos?.length ?? 0} {(videos?.length ?? 0) === 1 ? 'entry' : 'entries'}
      </p>

      {/* Video Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i: number) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (videos?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-card/30 p-12 text-center">
          <Film className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">No videos match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(videos ?? []).map((video: VideoEntry, index: number) => {
            const isExpanded = expandedId === video?.id;

            return (
              <motion.div
                key={video?.id ?? index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                {/* Card Header */}
                <div className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-medium ${getPlatformColor(video?.platform ?? '')}`}>
                      {video?.platform ?? 'Unknown'}
                    </span>
                    <a
                      href={video?.url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title="Open original"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Creator */}
                  {video?.creator && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{video?.creator ?? ''}</span>
                    </div>
                  )}

                  {/* Video Type */}
                  {video?.videoType && (
                    <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">{video?.videoType ?? ''}</p>
                  )}

                  {/* Caption */}
                  {video?.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-3 mb-2">{video?.caption ?? ''}</p>
                  )}
                </div>

                {/* Tags */}
                <div className="px-4 pb-2">
                  <div className="flex flex-wrap gap-1">
                    {video?.promptText && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                        <FileText className="h-2.5 w-2.5" />
                        Full Prompt
                      </span>
                    )}
                    {video?.hasTimestamps && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Clock className="h-2.5 w-2.5" />
                        Timestamps
                      </span>
                    )}
                    {video?.hasCameraDir && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Camera className="h-2.5 w-2.5" />
                        Camera
                      </span>
                    )}
                    {video?.hasDialogue && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        <MessageCircle className="h-2.5 w-2.5" />
                        Dialogue
                      </span>
                    )}
                    {video?.hasSfx && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        <Volume2 className="h-2.5 w-2.5" />
                        SFX
                      </span>
                    )}
                    {video?.style && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                        <Tag className="h-2.5 w-2.5" />
                        {video?.style ?? ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Engagement */}
                <div className="px-4 pb-2 flex items-center gap-3">
                  {video?.likes != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Heart className="h-3 w-3" />
                      {formatNumber(video?.likes ?? null) ?? '0'}
                    </span>
                  )}
                  {video?.comments != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      {formatNumber(video?.comments ?? null) ?? '0'}
                    </span>
                  )}
                </div>

                {/* Expand/Collapse for prompt & insights */}
                {(video?.promptText || (video?.keyInsights?.length ?? 0) > 0) && (
                  <div className="mt-auto border-t border-border/30">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : (video?.id ?? null))}
                      className="w-full flex items-center justify-center gap-1.5 p-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          {video?.promptText ? 'View Prompt' : 'View Insights'}
                        </>
                      )}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 pt-0 space-y-3">
                            {/* Full Prompt */}
                            {video?.promptText && (
                              <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-xs font-semibold text-primary uppercase tracking-wider">Full Prompt</h5>
                                  <button
                                    onClick={() => handleCopy(video?.promptText ?? '', video?.id ?? '')}
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    {copiedId === video?.id ? (
                                      <Check className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                    {copiedId === video?.id ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                                <pre className="whitespace-pre-wrap text-xs font-mono text-foreground leading-relaxed max-h-[250px] overflow-y-auto">
                                  {video?.promptText ?? ''}
                                </pre>
                              </div>
                            )}

                            {/* Key Insights */}
                            {(video?.keyInsights?.length ?? 0) > 0 && (
                              <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                                <h5 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <Lightbulb className="h-3 w-3" />
                                  Key Insights
                                </h5>
                                <ul className="space-y-1">
                                  {(video?.keyInsights ?? []).map((insight: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                      {insight ?? ''}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Reference Image Info */}
                            {video?.referenceImage && (
                              <p className="text-xs text-muted-foreground italic">
                                Reference: {video?.referenceImage ?? ''}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
