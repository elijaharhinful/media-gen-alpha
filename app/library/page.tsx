"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  BookImage,
  ImageIcon,
  Film,
  Search,
  SlidersHorizontal,
  Download,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Filter,
  Maximize2,
  X,
} from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ─────────────────────────────────────────────────────
interface ImageItem {
  id: string;
  prompt: string;
  imageUrl?: string;
  referenceImages?: string[];
  style?: string;
  aspectRatio?: string;
  status: string;
  createdAt: string;
  type: "image";
}

interface VideoItem {
  id: string;
  prompt: string;
  videoUrl?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  resolution?: string;
  aspectRatio?: string;
  duration?: string;
  status: string;
  createdAt: string;
  type: "video";
}

type MediaItem = ImageItem | VideoItem;

type MediaType = "all" | "images" | "videos";
type SortOrder = "newest" | "oldest";
type StatusFilter = "all" | "completed" | "processing" | "failed" | "pending";

const downloadMedia = async (url: string, filename: string) => {
  const toastId = toast.loading("Preparing download...");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch file content");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast.success("Downloaded successfully!", { id: toastId });
  } catch (err) {
    console.error("Direct download failed, opening in new tab", err);
    toast.error("Download failed. Opening in new tab.", { id: toastId });
    window.open(url, "_blank");
  }
};

// ─── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    completed: {
      label: "Completed",
      cls: "bg-green-400/10 text-green-400 border-green-400/20",
      icon: <CheckCircle2 className="h-2.5 w-2.5" />,
    },
    processing: {
      label: "Processing",
      cls: "bg-amber-400/10 text-amber-400 border-amber-400/20",
      icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
    },
    failed: {
      label: "Failed",
      cls: "bg-red-400/10 text-red-400 border-red-400/20",
      icon: <XCircle className="h-2.5 w-2.5" />,
    },
    pending: {
      label: "Pending",
      cls: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      icon: <Clock className="h-2.5 w-2.5" />,
    },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls}`}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Image Lightbox ─────────────────────────────────────────────
function ImageLightbox({
  item,
  onClose,
  onOpenGenerator,
}: {
  item: ImageItem;
  onClose: () => void;
  onOpenGenerator: (item: ImageItem) => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative max-w-5xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="rounded-2xl overflow-hidden bg-black border border-white/10">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.prompt}
              className="w-full object-contain"
              style={{ maxHeight: "78vh" }}
            />
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm text-white/60 line-clamp-1 flex-1">
            {item.prompt}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.style && (
              <span className="text-xs text-white/40 bg-white/8 px-2 py-1 rounded-lg">
                {item.style}
              </span>
            )}
            {item.aspectRatio && (
              <span className="text-xs text-white/40 bg-white/8 px-2 py-1 rounded-lg">
                {item.aspectRatio}
              </span>
            )}
            {item.imageUrl && (
              <button
                onClick={() => downloadMedia(item.imageUrl!, `image-${item.id}.png`)}
                className="flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            )}
            <button
              onClick={() => onOpenGenerator(item)}
              className="flex items-center gap-1.5 text-xs text-black bg-lime-400 hover:bg-lime-500 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Open in Generator
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Video Modal ────────────────────────────────────────────────
function VideoModal({
  item,
  onClose,
  onOpenGenerator,
}: {
  item: VideoItem;
  onClose: () => void;
  onOpenGenerator: (item: VideoItem) => void;
}) {
  const vidRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    if (vidRef.current) vidRef.current.play().catch(() => {});
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative max-w-4xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="rounded-2xl overflow-hidden bg-black border border-white/10">
          {item.videoUrl ? (
            <video
              ref={vidRef}
              src={item.videoUrl}
              controls
              className="w-full"
              style={{ maxHeight: "74vh" }}
            />
          ) : (
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center">
                <Film className="h-12 w-12 text-purple-400/40 mx-auto mb-3" />
                <p className="text-sm text-white/50">
                  {item.status === "processing"
                    ? "Video is still processing…"
                    : "Video unavailable"}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm text-white/60 line-clamp-1 flex-1">
            {item.prompt}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.resolution && (
              <span className="text-xs text-white/40 bg-white/8 px-2 py-1 rounded-lg">
                {item.resolution}
              </span>
            )}
            {item.aspectRatio && (
              <span className="text-xs text-white/40 bg-white/8 px-2 py-1 rounded-lg">
                {item.aspectRatio}
              </span>
            )}
            {item.duration && (
              <span className="text-xs text-white/40 bg-white/8 px-2 py-1 rounded-lg">
                {item.duration}
              </span>
            )}
            {item.videoUrl && (
              <button
                onClick={() => downloadMedia(item.videoUrl!, `video-${item.id}.mp4`)}
                className="flex items-center gap-1.5 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            )}
            <button
              onClick={() => onOpenGenerator(item)}
              className="flex items-center gap-1.5 text-xs text-white bg-purple-500 hover:bg-purple-600 px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Open in Generator
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Image Card ─────────────────────────────────────────────────
function ImageCard({
  item,
  view,
  onOpen,
  onOpenGenerator,
}: {
  item: ImageItem;
  view: "grid" | "list";
  onOpen: () => void;
  onOpenGenerator: (item: ImageItem) => void;
}) {
  if (view === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onOpen}
        className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3 hover:border-lime-400/20 transition-colors group cursor-pointer"
      >
        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border/30">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.prompt}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.prompt}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={item.status} />
            {item.aspectRatio && (
              <span className="text-[10px] text-muted-foreground">
                {item.aspectRatio}
              </span>
            )}
            {item.style && (
              <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">
                {item.style}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {item.imageUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadMedia(item.imageUrl!, `image-${item.id}.png`);
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
              title="Download Image"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenGenerator(item);
            }}
            className="p-2 rounded-lg bg-lime-400/10 hover:bg-lime-400/20 text-lime-400"
            title="Open in Generator"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onOpen}
      className="group relative rounded-xl overflow-hidden border border-border/50 bg-card/60 backdrop-blur-sm hover:border-lime-400/20 transition-all cursor-pointer"
    >
      <div className="relative aspect-square bg-muted">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.prompt}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* Buttons */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenGenerator(item);
            }}
            className="p-1.5 rounded-lg bg-lime-400/80 backdrop-blur-sm text-black hover:bg-lime-400"
            title="Open in Generator"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          {item.imageUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadMedia(item.imageUrl!, `image-${item.id}.png`);
              }}
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80"
              title="Download Image"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Expand icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="p-2.5 rounded-full bg-black/50 backdrop-blur-sm ring-1 ring-white/20">
            <Maximize2 className="h-5 w-5 text-white" />
          </div>
        </div>
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] text-lime-400 font-medium">
            <ImageIcon className="h-2.5 w-2.5" /> Image
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium truncate mb-1.5">{item.prompt}</p>
        <div className="flex items-center justify-between">
          <StatusBadge status={item.status} />
          <div className="flex items-center gap-1.5">
            {item.aspectRatio && (
              <span className="text-[10px] text-muted-foreground">
                {item.aspectRatio}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Video Card ─────────────────────────────────────────────────
function VideoCard({
  item,
  view,
  onOpen,
  onOpenGenerator,
}: {
  item: VideoItem;
  view: "grid" | "list";
  onOpen: () => void;
  onOpenGenerator: (item: VideoItem) => void;
}) {
  if (view === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onOpen}
        className="flex items-center gap-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3 hover:border-purple-400/20 transition-colors group cursor-pointer"
      >
        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border/30 flex items-center justify-center">
          {item.videoUrl ? (
            <video
              src={item.videoUrl}
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <Film className="h-5 w-5 text-muted-foreground/40" />
          )}
          {item.status === "completed" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.prompt}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={item.status} />
            {item.resolution && (
              <span className="text-[10px] text-muted-foreground">
                {item.resolution}
              </span>
            )}
            {item.aspectRatio && (
              <span className="text-[10px] text-muted-foreground">
                {item.aspectRatio}
              </span>
            )}
            {item.duration && (
              <span className="text-[10px] text-muted-foreground">
                {item.duration}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {item.videoUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadMedia(item.videoUrl!, `video-${item.id}.mp4`);
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
              title="Download Video"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenGenerator(item);
            }}
            className="p-2 rounded-lg bg-purple-400/10 hover:bg-purple-400/20 text-purple-400"
            title="Open in Generator"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onOpen}
      className="group relative rounded-xl overflow-hidden border border-border/50 bg-card/60 backdrop-blur-sm hover:border-purple-400/20 transition-all cursor-pointer"
    >
      <div className="relative aspect-video bg-muted flex items-center justify-center">
        {item.videoUrl ? (
          <video
            src={item.videoUrl}
            className="w-full h-full object-cover"
            muted
          />
        ) : (
          <Film className="h-8 w-8 text-muted-foreground/30" />
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Buttons */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenGenerator(item);
            }}
            className="p-1.5 rounded-lg bg-purple-500/80 backdrop-blur-sm text-white hover:bg-purple-500"
            title="Open in Generator"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          {item.videoUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadMedia(item.videoUrl!, `video-${item.id}.mp4`);
              }}
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80"
              title="Download Video"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {item.status === "processing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
          </div>
        )}
        {item.status === "completed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="h-8 w-8 text-white" />
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] text-purple-400 font-medium">
            <Film className="h-2.5 w-2.5" /> Video
          </span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-medium truncate mb-1.5">{item.prompt}</p>
        <div className="flex items-center justify-between flex-wrap gap-1">
          <StatusBadge status={item.status} />
          <div className="flex items-center gap-1.5">
            {item.resolution && (
              <span className="text-[10px] text-muted-foreground">
                {item.resolution}
              </span>
            )}
            {item.duration && (
              <span className="text-[10px] text-muted-foreground">
                {item.duration}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Library Inner (uses useSearchParams) ───────────────────────
function LibraryInner() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as MediaType) || "all";

  const [mediaType, setMediaType] = useState<MediaType>(initialType);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  const [imgPage, setImgPage] = useState(1);
  const [vidPage, setVidPage] = useState(1);

  const LIMIT = 24;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const { data: imgData, isLoading: imgLoading } = useSWR(
    status === "authenticated" ? `/api/images/history?page=${imgPage}&limit=${LIMIT}` : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { keepPreviousData: true }
  );

  const { data: vidData, isLoading: vidLoading } = useSWR(
    status === "authenticated" ? `/api/videos/history?page=${vidPage}&limit=${LIMIT}` : null,
    (url: string) => fetch(url).then((r) => r.json()),
    { keepPreviousData: true }
  );

  const images: ImageItem[] = (imgData?.images || []).map((i: any) => ({ ...i, type: "image" }));
  const videos: VideoItem[] = (vidData?.videos || []).map((v: any) => ({ ...v, type: "video" }));
  const imgTotal = imgData?.total || 0;
  const vidTotal = vidData?.total || 0;
  const loading = imgLoading || vidLoading || status === "loading";

  // Derived — merge + filter + sort
  const allItems: MediaItem[] = (() => {
    let items: MediaItem[] = [];
    if (mediaType === "all" || mediaType === "images")
      items = [...items, ...images];
    if (mediaType === "all" || mediaType === "videos")
      items = [...items, ...videos];
    if (statusFilter !== "all")
      items = items.filter((i) => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.prompt.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });
    return items;
  })();

  const imgPages = Math.ceil(imgTotal / LIMIT);
  const vidPages = Math.ceil(vidTotal / LIMIT);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

    const handleOpenImageGenerator = (item: ImageItem) => {
      sessionStorage.setItem('img-gen-init', JSON.stringify({
        prompt: item.prompt,
        style: item.style,
        aspectRatio: item.aspectRatio,
        referenceImages: item.referenceImages || [],
      }));
      router.push('/image-generator');
    };

    const handleOpenVideoGenerator = (item: VideoItem) => {
      sessionStorage.setItem('vid-gen-init', JSON.stringify({
        prompt: item.prompt,
        resolution: item.resolution,
        aspectRatio: item.aspectRatio,
        duration: item.duration,
        referenceImages: item.referenceImages || [],
        referenceVideos: item.referenceVideos || [],
        referenceAudios: item.referenceAudios || [],
      }));
      router.push('/video-generator');
    };

  return (
    <>
      <AnimatePresence>
        {selectedItem?.type === "image" && (
          <ImageLightbox
            item={selectedItem as ImageItem}
            onClose={() => setSelectedItem(null)}
            onOpenGenerator={handleOpenImageGenerator}
          />
        )}
        {selectedItem?.type === "video" && (
          <VideoModal
            item={selectedItem as VideoItem}
            onClose={() => setSelectedItem(null)}
            onOpenGenerator={handleOpenVideoGenerator}
          />
        )}
      </AnimatePresence>
      <div className="min-h-screen">
        {/* Hero */}
        <section className="pt-12 pb-8 px-4 border-b border-border/40">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                  Media <span className="text-cyan-400">Library</span>
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  All your generated images and videos in one place
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border/40">
                  <ImageIcon className="h-3.5 w-3.5 text-lime-400" />
                  {imgTotal} images
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border/40">
                  <Film className="h-3.5 w-3.5 text-purple-400" />
                  {vidTotal} videos
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="sticky top-14 z-30 border-b border-border/40 bg-background/90 backdrop-blur-xl px-4 py-3">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Tabs */}
              <div className="flex items-center rounded-xl bg-white/5 border border-border/40 p-1 gap-0.5">
                {(["all", "images", "videos"] as MediaType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMediaType(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      mediaType === t
                        ? t === "images"
                          ? "bg-lime-400/15 text-lime-400"
                          : t === "videos"
                            ? "bg-purple-400/15 text-purple-400"
                            : "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "images" && <ImageIcon className="h-3 w-3" />}
                    {t === "videos" && <Film className="h-3 w-3" />}
                    {t === "all" && <Filter className="h-3 w-3" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search prompts..."
                  className="w-full rounded-xl border border-border/50 bg-background/50 pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/30 text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/30 text-foreground"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              {/* Sort */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/30 text-foreground"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>

              {/* View toggle */}
              <div className="flex items-center rounded-xl bg-white/5 border border-border/40 p-1 gap-0.5 ml-auto">
                <button
                  onClick={() => setView("grid")}
                  className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Grid / List */}
        <section className="px-4 py-8">
          <div className="mx-auto max-w-[1200px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Loading your library...
                </p>
              </div>
            ) : allItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-cyan-400/10 flex items-center justify-center">
                  <BookImage className="h-8 w-8 text-cyan-400/50" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Nothing here yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {search
                      ? "No results match your search."
                      : "Generate some images or videos to see them here."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  Showing {allItems.length} item
                  {allItems.length !== 1 ? "s" : ""}
                </p>
                <AnimatePresence mode="popLayout">
                  <div
                    className={
                      view === "grid"
                        ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                        : "flex flex-col gap-2"
                    }
                  >
                    {allItems.map((item) =>
                      item.type === "image" ? (
                        <ImageCard
                          key={`img-${item.id}`}
                          item={item as ImageItem}
                          view={view}
                          onOpen={() => setSelectedItem(item)}
                          onOpenGenerator={handleOpenImageGenerator}
                        />
                      ) : (
                        <VideoCard
                          key={`vid-${item.id}`}
                          item={item as VideoItem}
                          view={view}
                          onOpen={() => setSelectedItem(item)}
                          onOpenGenerator={handleOpenVideoGenerator}
                        />
                      ),
                    )}
                  </div>
                </AnimatePresence>

                {/* Pagination controls */}
                {(mediaType === "all" || mediaType === "images") &&
                  imgPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-3">
                      <p className="text-xs text-muted-foreground mr-2">
                        Images page:
                      </p>
                      <button
                        disabled={imgPage <= 1}
                        onClick={() => setImgPage((p) => p - 1)}
                        className="p-1.5 rounded-lg bg-white/5 border border-border/40 disabled:opacity-40 hover:bg-white/10 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs">
                        {imgPage} / {imgPages}
                      </span>
                      <button
                        disabled={imgPage >= imgPages}
                        onClick={() => setImgPage((p) => p + 1)}
                        className="p-1.5 rounded-lg bg-white/5 border border-border/40 disabled:opacity-40 hover:bg-white/10 transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                {(mediaType === "all" || mediaType === "videos") &&
                  vidPages > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <p className="text-xs text-muted-foreground mr-2">
                        Videos page:
                      </p>
                      <button
                        disabled={vidPage <= 1}
                        onClick={() => setVidPage((p) => p - 1)}
                        className="p-1.5 rounded-lg bg-white/5 border border-border/40 disabled:opacity-40 hover:bg-white/10 transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs">
                        {vidPage} / {vidPages}
                      </span>
                      <button
                        disabled={vidPage >= vidPages}
                        onClick={() => setVidPage((p) => p + 1)}
                        className="p-1.5 rounded-lg bg-white/5 border border-border/40 disabled:opacity-40 hover:bg-white/10 transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

// ─── Page Export (wraps in Suspense for useSearchParams) ─────────
export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
        </div>
      }
    >
      <LibraryInner />
    </Suspense>
  );
}
