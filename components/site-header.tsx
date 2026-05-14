"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Sparkles,
  ImageIcon,
  Film,
  Wand2,
  LayoutDashboard,
  LogOut,
  LogIn,
  Menu,
  X,
  Settings,
  BookImage,
  ListTodo,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Play,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect, useCallback } from "react";

const DISMISSED_KEY = "tasks_dismissed_ids";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch {}
}

function TaskDetailModal({ task, onClose, onOpenGenerator }: {
  task: any;
  onClose: () => void;
  onOpenGenerator: (task: any) => void;
}) {
  const isActive = task.status === "processing" || task.status === "pending";
  const isFailed = task.status === "failed";
  const isCompleted = task.status === "completed";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 12 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card/98 backdrop-blur-xl shadow-2xl overflow-hidden"
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>

        {/* Media area */}
        <div className="relative w-full bg-black/40" style={{ aspectRatio: "16/9" }}>
          {isCompleted && task.videoUrl ? (
            <video src={task.videoUrl} controls className="w-full h-full object-contain" />
          ) : isCompleted && task.imageUrl ? (
            <Image src={task.imageUrl} alt="result" fill className="object-contain" />
          ) : isActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
              <p className="text-sm text-muted-foreground">Generating{task.type === "video" ? " video" : " image"}…</p>
              <div className="w-40 h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div className="h-full bg-amber-400 rounded-full" animate={{ x: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <XCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-400">Generation failed</p>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            {task.type === "video" ? <Film className="h-4 w-4 text-purple-400" /> : <ImageIcon className="h-4 w-4 text-lime-400" />}
            <span className={`text-xs font-semibold uppercase tracking-wide ${task.type === "video" ? "text-purple-400" : "text-lime-400"}`}>
              {task.type === "video" ? "Video Generation" : "Image Generation"}
            </span>
            {isCompleted && <span className="ml-auto flex items-center gap-1 text-[10px] text-green-400"><CheckCircle2 className="h-3 w-3" /> Completed</span>}
            {isActive && <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400"><Clock className="h-3 w-3" /> Processing</span>}
            {isFailed && <span className="ml-auto flex items-center gap-1 text-[10px] text-red-400"><XCircle className="h-3 w-3" /> Failed</span>}
          </div>
          {task.prompt && <p className="text-sm text-foreground line-clamp-3">{task.prompt}</p>}
          {isCompleted && (
            <button
              onClick={() => { onClose(); onOpenGenerator(task); }}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors ${
                task.type === "video" ? "bg-purple-400/10 hover:bg-purple-400/20 text-purple-400 border border-purple-400/20" : "bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 border border-lime-400/20"
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> Open in Generator
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TasksDropdown({
  activeTaskCount,
  pathname,
}: {
  activeTaskCount: number;
  pathname: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(getDismissed());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const { data: tasksData, isLoading } = useSWR(
    open ? "header_tasks" : null,
    async () => {
      const [imgRes, vidRes] = await Promise.all([
        fetch("/api/images/history?limit=10"),
        fetch("/api/videos/history?limit=10"),
      ]);
      const imgData = await imgRes.json();
      const vidData = await vidRes.json();
      const imageTasks = (imgData.images || []).map((i: any) => ({ ...i, type: "image" }));
      const videoTasks = (vidData.videos || []).map((v: any) => ({ ...v, type: "video" }));
      return [...imageTasks, ...videoTasks].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
    { refreshInterval: 5000 },
  );

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    const finishedIds = (tasksData || []).filter((t: any) => t.status === "completed" || t.status === "failed").map((t: any) => t.id as string);
    setDismissed((prev) => {
      const next = new Set(prev);
      finishedIds.forEach((id: string) => next.add(id));
      saveDismissed(next);
      return next;
    });
  }, [tasksData]);

  const handleOpenGenerator = useCallback((task: any) => {
    if (task.type === "image") {
      sessionStorage.setItem("img-gen-init", JSON.stringify({ prompt: task.prompt, style: task.style, aspectRatio: task.aspectRatio, referenceImages: task.referenceImages || [] }));
      router.push("/image-generator");
    } else if (task.type === "video") {
      sessionStorage.setItem("vid-gen-init", JSON.stringify({ prompt: task.prompt, resolution: task.resolution, aspectRatio: task.aspectRatio, duration: task.duration, referenceImages: task.referenceImages || [], referenceVideos: task.referenceVideos || [], referenceAudios: task.referenceAudios || [] }));
      router.push("/video-generator");
    }
    setOpen(false);
  }, [router]);

  const allTasks = (tasksData || []) as any[];
  const visibleTasks = allTasks.filter((t: any) => !dismissed.has(t.id));
  const hasCompleted = visibleTasks.some((t: any) => t.status === "completed" || t.status === "failed");
  const isActivePath = pathname === "/tasks";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActivePath || open ? "text-amber-400 bg-white/5" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ListTodo className="h-4 w-4" />
        <span>Tasks</span>
        {activeTaskCount > 0 && (
          <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-black">
            {activeTaskCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onOpenGenerator={handleOpenGenerator}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-2 text-[10px] font-bold text-muted-foreground tracking-wider border-b border-border/40">
              <span>RECENT TASKS</span>
              {hasCompleted && (
                <button onClick={clearCompleted} className="text-muted-foreground hover:text-red-400 transition-colors">
                  × Clear completed
                </button>
              )}
            </div>

            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
              {isLoading ? (
                <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : visibleTasks.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">No tasks found.</div>
              ) : (
                visibleTasks.map((task: any) => {
                  const isTaskActive = task.status === "processing" || task.status === "pending";
                  const thumbnailSrc = task.type === "image" ? task.imageUrl : (task.startFrameUrl || null);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 group relative cursor-pointer"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0 relative">
                        {task.type === "video" && task.videoUrl && task.status === "completed" ? (
                          <video src={task.videoUrl} muted loop className="w-full h-full object-cover" />
                        ) : thumbnailSrc ? (
                          <Image src={thumbnailSrc} alt="thumbnail" fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/5">
                            {task.type === "video" ? <Film className="h-4 w-4 text-purple-400/50" /> : <ImageIcon className="h-4 w-4 text-lime-400/50" />}
                          </div>
                        )}
                        {isTaskActive && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                          </div>
                        )}
                        {task.status === "completed" && task.type === "video" && !isTaskActive && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {task.type === "video" ? "Video" : "Image"}
                          {isTaskActive && <span className="ml-1 text-amber-400">(Processing)</span>}
                          {task.status === "failed" && <span className="ml-1 text-red-400">(Failed)</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{task.prompt || "No prompt"}</p>
                      </div>
                      {!isTaskActive && (
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-muted-foreground transition-all flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); dismiss(task.id); }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-2 border-t border-border/40">
              <Link
                href="/tasks"
                onClick={() => setOpen(false)}
                className="block w-full py-2 text-center text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Show all tasks
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const toolNavItems = [
  {
    href: "/multiplier",
    label: "Multiplier",
    icon: Wand2,
    accent: "text-blue-400",
  },
  {
    href: "/image-generator",
    label: "Images",
    icon: ImageIcon,
    accent: "text-lime-400",
  },
  {
    href: "/video-generator",
    label: "Videos",
    icon: Film,
    accent: "text-purple-400",
  },
  {
    href: "/library",
    label: "Library",
    icon: BookImage,
    accent: "text-cyan-400",
  },
  { href: "/tasks", label: "Tasks", icon: ListTodo, accent: "text-amber-400" },
];

function ProfileAvatar({
  name,
  email,
}: {
  name?: string | null;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : email
      ? email[0].toUpperCase()
      : "U";

  // Consistent gradient based on initials
  const gradients = [
    "from-lime-400 to-emerald-500",
    "from-purple-400 to-violet-600",
    "from-blue-400 to-cyan-500",
    "from-amber-400 to-orange-500",
    "from-pink-400 to-rose-500",
  ];
  const gradientIdx = initials.charCodeAt(0) % gradients.length;

  return (
    <div className="relative" ref={ref}>
      <button
        id="profile-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl p-1 hover:bg-white/5 transition-colors"
        aria-label="Profile menu"
      >
        <div
          className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradients[gradientIdx]} flex items-center justify-center text-xs font-bold text-white shadow-lg ring-2 ring-white/10`}
        >
          {initials}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50"
          >
            {/* User info */}
            <div className="px-4 py-3 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradients[gradientIdx]} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  {name && (
                    <p className="text-sm font-medium truncate">{name}</p>
                  )}
                  {email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-400/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, status } = useSession() || {};
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/tasks/active-count");
        const data = await res.json();
        const count = data.activeCount ?? 0;
        setActiveTaskCount(count);
        if (count === 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch {}
    }, 10000);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Initial fetch
    fetch("/api/tasks/active-count")
      .then((r) => r.json())
      .then((data) => {
        const count = data.activeCount ?? 0;
        setActiveTaskCount(count);
        if (count > 0) startPolling();
      })
      .catch(() => {});

    // Listen for task-started events from this tab
    const handleTaskStarted = () => { setActiveTaskCount((c) => Math.max(c, 1)); startPolling(); };
    window.addEventListener("task-started", handleTaskStarted);

    // BroadcastChannel for cross-tab sync
    try {
      const bc = new BroadcastChannel("task_channel");
      channelRef.current = bc;
      bc.onmessage = (e) => { if (e.data === "task-started") handleTaskStarted(); };
    } catch {}

    return () => {
      window.removeEventListener("task-started", handleTaskStarted);
      if (intervalRef.current) clearInterval(intervalRef.current);
      channelRef.current?.close();
    };
  }, [status, startPolling]);

  // Don't show header on login/signup pages
  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 via-blue-500 to-purple-500">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight hidden sm:inline">
            Movie Gen{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-blue-400 to-purple-400">
              Alpha
            </span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {toolNavItems.map((item) => {
            if (item.href === "/tasks") {
              return (
                <TasksDropdown
                  key={item.href}
                  activeTaskCount={activeTaskCount}
                  pathname={pathname}
                />
              );
            }

            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? item.accent
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute inset-0 rounded-lg bg-white/5"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}

          {isAdmin && (
            <Link href="/admin">
              <motion.div
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname?.startsWith("/admin")
                    ? "text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Admin</span>
              </motion.div>
            </Link>
          )}
        </nav>

        {/* Right side: Auth + Mobile */}
        <div className="flex items-center gap-2">
          {status === "authenticated" ? (
            <ProfileAvatar
              name={(session?.user as any)?.name}
              email={(session?.user as any)?.email}
            />
          ) : status === "unauthenticated" ? (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          ) : null}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="flex flex-col gap-1 p-3">
              {toolNavItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive
                        ? item.accent + " bg-white/5"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {item.href === "/tasks" && activeTaskCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">
                        {activeTaskCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    pathname?.startsWith("/admin")
                      ? "text-amber-400 bg-white/5"
                      : "text-muted-foreground"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Admin
                </Link>
              )}
              {/* Mobile auth */}
              {status === "authenticated" && (
                <>
                  <div className="my-1 border-t border-border/40" />
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-red-400 text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
