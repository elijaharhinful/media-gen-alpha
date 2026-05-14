"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ListTodo,
  ImageIcon,
  Film,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────
interface Task {
  id: string;
  type: "image" | "video" | "character";
  prompt: string;
  status: string;
  createdAt: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: string;
  style?: string;
  imageUrl?: string;
  videoUrl?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
}

type FilterType = "all" | "image" | "video" | "character";
type FilterStatus = "all" | "active" | "completed" | "failed";
type SortOrder = "newest" | "oldest";
const PAGE_SIZES = [10, 20, 50] as const;

// ─── Task Card ───────────────────────────────────────────────
function TaskCard({ task, onOpenGenerator }: { task: Task; onOpenGenerator: (task: Task) => void }) {
  const isActive = task.status === "processing" || task.status === "pending";

  const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    completed: { label: "Completed", cls: "bg-green-400/10 text-green-400 border-green-400/20", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    processing: { label: "Processing", cls: "bg-amber-400/10 text-amber-400 border-amber-400/20", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    pending: { label: "Pending", cls: "bg-blue-400/10 text-blue-400 border-blue-400/20", icon: <Clock className="h-3.5 w-3.5" /> },
    failed: { label: "Failed", cls: "bg-red-400/10 text-red-400 border-red-400/20", icon: <XCircle className="h-3.5 w-3.5" /> },
  };

  const cfg = statusConfig[task.status] ?? statusConfig.pending;
  const typeColor = task.type === "image" ? "text-lime-400" : task.type === "video" ? "text-purple-400" : "text-pink-400";
  const typeBg = task.type === "image" ? "bg-lime-400/10 border-lime-400/20" : task.type === "video" ? "bg-purple-400/10 border-purple-400/20" : "bg-pink-400/10 border-pink-400/20";
  const TypeIcon = task.type === "image" ? ImageIcon : task.type === "video" ? Film : Users;

  const relTime = (() => {
    const diff = Date.now() - new Date(task.createdAt).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(task.createdAt).toLocaleDateString();
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={`relative rounded-2xl border bg-card/60 backdrop-blur-sm p-4 transition-all ${
        isActive ? "border-amber-400/30 shadow-lg shadow-amber-400/5" : task.status === "completed" ? "border-green-400/20" : task.status === "failed" ? "border-red-400/20" : "border-border/50"
      }`}
    >
      {isActive && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${typeBg}`}>
          <TypeIcon className={`h-4.5 w-4.5 ${typeColor}`} style={{ width: "1.1rem", height: "1.1rem" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${typeColor}`}>
              {task.type === "image" ? "Image Generation" : task.type === "video" ? "Video Generation" : "Character Creation"}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[10px] text-muted-foreground">{relTime}</span>
          </div>
          <p className="text-sm font-medium line-clamp-2 mb-2">{task.prompt}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
              {cfg.icon} {cfg.label}
            </span>
            {task.type === "video" && task.resolution && <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{task.resolution}</span>}
            {task.type === "video" && task.aspectRatio && <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{task.aspectRatio}</span>}
            {task.type === "video" && task.duration && <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{task.duration}</span>}
            {task.type === "image" && task.style && <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">{task.style}</span>}
          </div>
        </div>
      </div>

      {isActive && (
        <div className="mt-3 w-full h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
        </div>
      )}

      {task.status === "completed" && task.type !== "character" && (
        <div className="mt-3 flex justify-end">
          <button onClick={() => onOpenGenerator(task)} className={`text-xs font-medium ${typeColor} hover:opacity-80 transition-opacity`}>
            Open in generator →
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────
export default function TasksPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  // Filter / sort / pagination state
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);

  // Raw data
  const [imageTasks, setImageTasks] = useState<Task[]>([]);
  const [videoTasks, setVideoTasks] = useState<Task[]>([]);
  const [charTasks, setCharTasks] = useState<Task[]>([]);
  const [imgTotal, setImgTotal] = useState(0);
  const [vidTotal, setVidTotal] = useState(0);
  const [charTotal, setCharTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Active polling
  const activePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const fetchPage = useCallback(async (pg: number, ps: number) => {
    if (status !== "authenticated") return;
    setLoading(true);
    try {
      const [imgRes, vidRes, charRes] = await Promise.all([
        fetch(`/api/images/history?page=${pg}&limit=${ps}`),
        fetch(`/api/videos/history?page=${pg}&limit=${ps}`),
        fetch(`/api/characters`),
      ]);
      const imgData = await imgRes.json();
      const vidData = await vidRes.json();
      const charData = await charRes.json();

      setImageTasks((imgData.images || []).map((i: any) => ({ ...i, type: "image" })));
      setVideoTasks((vidData.videos || []).map((v: any) => ({ ...v, type: "video" })));
      setCharTasks((charData.characters || []).map((c: any) => ({ ...c, type: "character", prompt: `Character: ${c.name}` })));
      setImgTotal(imgData.total || 0);
      setVidTotal(vidData.total || 0);
      setCharTotal((charData.characters || []).length);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Initial load + page/size changes
  useEffect(() => {
    fetchPage(page, pageSize);
  }, [fetchPage, page, pageSize]);

  // Auto-poll when active tasks exist
  useEffect(() => {
    const allTasks = [...imageTasks, ...videoTasks, ...charTasks];
    const hasActive = allTasks.some((t) => t.status === "processing" || t.status === "pending");
    if (hasActive && !activePollRef.current) {
      activePollRef.current = setInterval(() => fetchPage(page, pageSize), 10000);
    }
    if (!hasActive && activePollRef.current) {
      clearInterval(activePollRef.current);
      activePollRef.current = null;
    }
    return () => {};
  }, [imageTasks, videoTasks, charTasks, fetchPage, page, pageSize]);

  useEffect(() => () => { if (activePollRef.current) clearInterval(activePollRef.current); }, []);

  const handleOpenGenerator = (task: Task) => {
    if (task.type === "image") {
      sessionStorage.setItem("img-gen-init", JSON.stringify({ prompt: task.prompt, style: task.style, aspectRatio: task.aspectRatio, referenceImages: task.referenceImages || [] }));
      router.push("/image-generator");
    } else if (task.type === "video") {
      sessionStorage.setItem("vid-gen-init", JSON.stringify({ prompt: task.prompt, resolution: task.resolution, aspectRatio: task.aspectRatio, duration: task.duration, referenceImages: task.referenceImages || [], referenceVideos: task.referenceVideos || [], referenceAudios: task.referenceAudios || [] }));
      router.push("/video-generator");
    }
  };

  // Combine + filter + sort (client-side on the current page's data)
  const combined = [...imageTasks, ...videoTasks, ...charTasks];

  const filtered = combined.filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterStatus === "active" && t.status !== "processing" && t.status !== "pending") return false;
    if (filterStatus === "completed" && t.status !== "completed") return false;
    if (filterStatus === "failed" && t.status !== "failed") return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sortOrder === "newest" ? diff : -diff;
  });

  const activeTasks = combined.filter((t) => t.status === "processing" || t.status === "pending");

  // Estimate total pages based on max of img/vid totals (rough heuristic for mixed pagination)
  const estimatedTotal = Math.max(imgTotal, vidTotal, charTotal);
  const totalPages = Math.max(1, Math.ceil(estimatedTotal / pageSize));

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const TypeBtn = ({ val, label }: { val: FilterType; label: string }) => (
    <button
      onClick={() => { setFilterType(val); setPage(1); }}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === val ? "bg-amber-400/15 text-amber-400 border border-amber-400/30" : "text-muted-foreground hover:text-foreground bg-white/5 border border-transparent"}`}
    >
      {label}
    </button>
  );

  const StatusBtn = ({ val, label }: { val: FilterStatus; label: string }) => (
    <button
      onClick={() => { setFilterStatus(val); setPage(1); }}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === val ? "bg-amber-400/15 text-amber-400 border border-amber-400/30" : "text-muted-foreground hover:text-foreground bg-white/5 border border-transparent"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="pt-12 pb-8 px-4 border-b border-border/40">
        <div className="mx-auto max-w-[800px]">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                Task <span className="text-amber-400">Queue</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">Monitor your active and completed generation jobs</p>
            </div>
            <button
              onClick={() => fetchPage(page, pageSize)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2">
            Last updated: {lastRefresh.toLocaleTimeString()} · {activeTasks.length > 0 ? "Auto-refreshes every 10s" : "Idle"}
          </p>
        </div>
      </section>

      {/* Filter + Sort bar */}
      <section className="sticky top-14 z-30 border-b border-border/40 bg-background/90 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto max-w-[800px] flex flex-wrap items-center gap-3">
          {/* Type filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground/60" />
            <TypeBtn val="all" label="All Types" />
            <TypeBtn val="image" label="Images" />
            <TypeBtn val="video" label="Videos" />
            <TypeBtn val="character" label="Characters" />
          </div>

          <div className="w-px h-5 bg-border/50" />

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <StatusBtn val="all" label="All Status" />
            <StatusBtn val="active" label="Active" />
            <StatusBtn val="completed" label="Completed" />
            <StatusBtn val="failed" label="Failed" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Sort */}
            <button
              onClick={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-white/5 border border-transparent hover:border-border/50 transition-colors"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === "newest" ? "Newest first" : "Oldest first"}
            </button>

            {/* Page size */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3 w-3" />
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-white/5 border border-border/30 rounded-lg px-2 py-1 text-xs text-muted-foreground focus:outline-none"
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </div>

            {/* Clear filters */}
            {(filterType !== "all" || filterStatus !== "all") && (
              <button
                onClick={() => { setFilterType("all"); setFilterStatus("all"); setPage(1); }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Tasks List */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-[800px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
              <p className="text-sm text-muted-foreground">Fetching tasks...</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 flex items-center justify-center">
                {filterType !== "all" || filterStatus !== "all" ? (
                  <AlertTriangle className="h-8 w-8 text-amber-400/50" />
                ) : (
                  <Sparkles className="h-8 w-8 text-amber-400/50" />
                )}
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {filterType !== "all" || filterStatus !== "all" ? "No matching tasks" : "No tasks yet"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {filterType !== "all" || filterStatus !== "all"
                    ? "Try adjusting your filters."
                    : "Generate some images or videos to see tasks here."}
                </p>
              </div>
              {filterType === "all" && filterStatus === "all" && (
                <div className="flex items-center gap-3 mt-2">
                  <Link href="/image-generator" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-400/10 border border-lime-400/20 text-lime-400 text-sm font-medium hover:bg-lime-400/20 transition-colors">
                    <ImageIcon className="h-4 w-4" /> Generate Image
                  </Link>
                  <Link href="/video-generator" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-400/10 border border-purple-400/20 text-purple-400 text-sm font-medium hover:bg-purple-400/20 transition-colors">
                    <Film className="h-4 w-4" /> Generate Video
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground/60 mb-4">
                Showing {sorted.length} task{sorted.length !== 1 ? "s" : ""} on page {page}
              </p>
              <AnimatePresence mode="popLayout">
                <div className="flex flex-col gap-3">
                  {sorted.map((task) => (
                    <TaskCard key={`${task.type}-${task.id}`} task={task} onOpenGenerator={handleOpenGenerator} />
                  ))}
                </div>
              </AnimatePresence>

              {/* Pagination */}
              <div className="mt-8 flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border/50 bg-white/5 hover:bg-white/10 text-xs text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pg = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i));
                      return (
                        <button
                          key={pg}
                          onClick={() => setPage(pg)}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${pg === page ? "bg-amber-400/15 text-amber-400 border border-amber-400/30" : "text-muted-foreground hover:text-foreground bg-white/5"}`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border/50 bg-white/5 hover:bg-white/10 text-xs text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
