'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Film, Loader2, AlertCircle, Play, Clock } from 'lucide-react';

interface VideoResult {
  id?: string;
  videoUrl?: string;
  status?: string;
  prompt?: string;
  message?: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: string | number;
}

interface ResultPanelProps {
  loading: boolean;
  result: VideoResult | null;
  history: VideoResult[];
  onSelectHistory: (vid: VideoResult) => void;
}

export function ResultPanel({ loading, result, history, onSelectHistory }: ResultPanelProps) {
  return (
    <div className="space-y-4">
      {/* Main result box */}
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
                      <p className="text-xs text-muted-foreground">Your video is being generated. Check back shortly.</p>
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

      {/* Recent videos */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Recent Videos
          </p>
          <div className="flex flex-col gap-2">
            {history.slice(0, 5).map((vid, i) => (
              <button
                key={vid.id ?? i}
                onClick={() => onSelectHistory(vid)}
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
  );
}
