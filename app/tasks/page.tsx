"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// Types ─────────────────────────────────────────────────────
interface Task {
  id: string;
  type: "image" | "video";
  prompt: string;
  status: string;
  createdAt: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: string;
  style?: string;
  imageUrl?: string;
  videoUrl?: string;
}

type TaskTab = "active" | "all";

// Task Card ─────────────────────────────────────────────────
function TaskCard({ task }: { task: Task }) {
  const isActive = task.status === "processing" || task.status === "pending";

  const statusConfig: Record<
    string,
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    completed: {
      label: "Completed",
      cls: "bg-green-400/10 text-green-400 border-green-400/20",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    processing: {
      label: "Processing",
      cls: "bg-amber-400/10 text-amber-400 border-amber-400/20",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    },
    pending: {
      label: "Pending",
      cls: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    failed: {
      label: "Failed",
      cls: "bg-red-400/10 text-red-400 border-red-400/20",
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
  };

  const cfg = statusConfig[task.status] ?? statusConfig.pending;
  const typeColor = task.type === "image" ? "text-lime-400" : "text-purple-400";
  const typeBg =
    task.type === "image"
      ? "bg-lime-400/10 border-lime-400/20"
      : "bg-purple-400/10 border-purple-400/20";
  const TypeIcon = task.type === "image" ? ImageIcon : Film;

  // Relative time
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
        isActive
          ? "border-amber-400/30 shadow-lg shadow-amber-400/5"
          : task.status === "completed"
            ? "border-green-400/20"
            : task.status === "failed"
              ? "border-red-400/20"
              : "border-border/50"
      }`}
    >
      {/* Active pulse ring */}
      {isActive && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
        </span>
      )}

      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div
          className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${typeBg}`}
        >
          <TypeIcon
            className={`h-4.5 w-4.5 ${typeColor}`}
            style={{ width: "1.1rem", height: "1.1rem" }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${typeColor}`}
            >
              {task.type === "image" ? "Image Generation" : "Video Generation"}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[10px] text-muted-foreground">{relTime}</span>
          </div>

          {/* Prompt */}
          <p className="text-sm font-medium line-clamp-2 mb-2">{task.prompt}</p>

          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}
            >
              {cfg.icon} {cfg.label}
            </span>
            {task.type === "video" && task.resolution && (
              <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                {task.resolution}
              </span>
            )}
            {task.type === "video" && task.aspectRatio && (
              <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                {task.aspectRatio}
              </span>
            )}
            {task.type === "video" && task.duration && (
              <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                {task.duration}
              </span>
            )}
            {task.type === "image" && task.style && (
              <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                {task.style}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar for active */}
      {isActive && (
        <div className="mt-3 w-full h-1 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
        </div>
      )}

      {/* View result link */}
      {task.status === "completed" && (
        <div className="mt-3 flex justify-end">
          <Link
            href={
              task.type === "image" ? "/image-generator" : "/video-generator"
            }
            className={`text-xs font-medium ${typeColor} hover:opacity-80 transition-opacity`}
          >
            Open in generator →
          </Link>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────
export default function TasksPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  const [tab, setTab] = useState<TaskTab>("active");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const fetcher = async () => {
    const [imgRes, vidRes] = await Promise.all([
      fetch("/api/images/history?limit=50"),
      fetch("/api/videos/history?limit=50"),
    ]);
    const imgData = await imgRes.json();
    const vidData = await vidRes.json();

    const imageTasks: Task[] = (imgData.images || []).map((i: any) => ({
      ...i,
      type: "image",
    }));
    const videoTasks: Task[] = (vidData.videos || []).map((v: any) => ({
      ...v,
      type: "video",
    }));

    const all = [...imageTasks, ...videoTasks].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return all;
  };

  const { data: tasksData, isLoading, mutate } = useSWR(
    status === "authenticated" ? "tasks_all" : null,
    fetcher,
    { refreshInterval: 10000, onSuccess: () => setLastRefresh(new Date()) }
  );

  const tasks = tasksData || [];
  const loading = isLoading || status === "loading";

  const activeTasks = tasks.filter(
    (t) => t.status === "processing" || t.status === "pending",
  );
  const displayedTasks = tab === "active" ? activeTasks : tasks;

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

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
              <p className="text-muted-foreground mt-1 text-sm">
                Monitor your active and completed generation jobs
              </p>
            </div>
            <button
              onClick={() => mutate()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/50 bg-white/5 hover:bg-white/10 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-2">
            Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes
            every 10s
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="sticky top-14 z-30 border-b border-border/40 bg-background/90 backdrop-blur-xl px-4">
        <div className="mx-auto max-w-[800px] flex items-center gap-0">
          {(["active", "all"] as TaskTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                tab === t
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "active" ? (
                <>
                  <span className="relative flex h-2 w-2">
                    {activeTasks.length > 0 && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${activeTasks.length > 0 ? "bg-amber-400" : "bg-muted-foreground/40"}`}
                    />
                  </span>
                  Active
                  {activeTasks.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-400 text-[10px] font-semibold">
                      {activeTasks.length}
                    </span>
                  )}
                </>
              ) : (
                <>
                  All Tasks
                  {tasks.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground text-[10px] font-semibold">
                      {tasks.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
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
          ) : displayedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-400/10 flex items-center justify-center">
                {tab === "active" ? (
                  <Sparkles className="h-8 w-8 text-amber-400/50" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-amber-400/50" />
                )}
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {tab === "active" ? "No active tasks" : "No tasks yet"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tab === "active"
                    ? "All generation jobs are complete. Start a new one!"
                    : "Generate some images or videos to see tasks here."}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Link
                  href="/image-generator"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-400/10 border border-lime-400/20 text-lime-400 text-sm font-medium hover:bg-lime-400/20 transition-colors"
                >
                  <ImageIcon className="h-4 w-4" /> Generate Image
                </Link>
                <Link
                  href="/video-generator"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-400/10 border border-purple-400/20 text-purple-400 text-sm font-medium hover:bg-purple-400/20 transition-colors"
                >
                  <Film className="h-4 w-4" /> Generate Video
                </Link>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="flex flex-col gap-3">
                {displayedTasks.map((task) => (
                  <TaskCard key={`${task.type}-${task.id}`} task={task} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </section>
    </div>
  );
}
