"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Film,
  Sparkles,
  Loader2,
  Clapperboard,
  Layers,
  Users,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  MentionTextarea,
  MentionOption,
} from "@/components/video-generator/MentionTextarea";
import { KeyframeInput } from "@/components/video-generator/KeyframeInput";
import {
  ReferenceInput,
  MediaRef,
} from "@/components/video-generator/ReferenceInput";
import { VideoSettings } from "@/components/video-generator/VideoSettings";
import { ResultPanel } from "@/components/video-generator/ResultPanel";
import { CharacterModal } from "@/components/video-generator/CharacterModal";
import type { FrameImage } from "@/components/video-generator/FrameSlot";

type InputMode = "keyframe" | "reference";

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
        active
          ? "border-purple-400 text-purple-400 bg-purple-400/5"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const uploadFile = async (file: File): Promise<string> => {
  const presignRes = await fetch("/api/upload/presigned", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      isPublic: true,
    }),
  });
  const { uploadUrl, cloud_storage_path } = await presignRes.json();
  const url = new URL(uploadUrl);
  const signedHeaders = url.searchParams.get("X-Amz-SignedHeaders") || "";
  const headers: Record<string, string> = { "Content-Type": file.type };
  if (signedHeaders.includes("content-disposition"))
    headers["Content-Disposition"] = "attachment";
  await fetch(uploadUrl, { method: "PUT", headers, body: file });
  return cloud_storage_path;
};

// Helper for smart tag syncing
function rewritePromptMediaTags(
  prompt: string,
  oldRefs: MediaRef[],
  newRefs: MediaRef[],
  prefix: string,
): string {
  let newPrompt = prompt;

  // 1. Replace all existing tags with temporary UUID tags
  oldRefs.forEach((ref, index) => {
    const tag = `@${prefix}${index + 1}`;
    const tempTag = `__TEMP_${ref.id}__`;
    newPrompt = newPrompt.replace(new RegExp(tag, "gi"), tempTag);
  });

  // 2. Replace temp tags with their new correct index tags
  newRefs.forEach((ref, index) => {
    const tempTag = `__TEMP_${ref.id}__`;
    const newTag = `@${prefix}${index + 1}`;
    newPrompt = newPrompt.replace(new RegExp(tempTag, "g"), newTag);
  });

  // 3. Clean up deleted refs
  oldRefs.forEach((ref) => {
    const tempTag = `__TEMP_${ref.id}__`;
    newPrompt = newPrompt.replace(
      new RegExp(tempTag, "g"),
      `@deleted_${prefix}`,
    );
  });

  return newPrompt;
}

export default function VideoGeneratorPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("keyframe");
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(5);

  const [startFrame, setStartFrame] = useState<FrameImage | null>(null);
  const [endFrame, setEndFrame] = useState<FrameImage | null>(null);

  const [refImages, setRefImages] = useState<MediaRef[]>([]);
  const [refVideos, setRefVideos] = useState<MediaRef[]>([]);
  const [refAudios, setRefAudios] = useState<MediaRef[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [charModalOpen, setCharModalOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const { data: historyData, mutate: mutateHistory } = useSWR(
    status === "authenticated" ? "/api/videos/history?limit=5" : null,
    (url: string) => fetch(url).then((r) => r.json()),
  );

  const history = historyData?.videos || [];

  const { data: charData, mutate: mutateChars } = useSWR(
    status === "authenticated" ? "/api/characters" : null,
    (url: string) => fetch(url).then((r) => r.json()),
  );
  const characters = charData?.characters || [];

  // Construct Mention Options
  const mentionOptions: MentionOption[] = [
    ...refImages.map((_, i) => ({
      type: "image" as const,
      id: `img_${i}`,
      display: `Image ${i + 1}`,
      insertText: `image${i + 1}`,
    })),
    ...refVideos.map((_, i) => ({
      type: "video" as const,
      id: `vid_${i}`,
      display: `Video ${i + 1}`,
      insertText: `video${i + 1}`,
    })),
    ...refAudios.map((_, i) => ({
      type: "audio" as const,
      id: `aud_${i}`,
      display: `Audio ${i + 1}`,
      insertText: `audio${i + 1}`,
    })),
    ...characters.map((c: any) => ({
      type: "character" as const,
      id: c.id,
      display: `Character: ${c.name}`,
      insertText: c.name.replace(/\s+/g, ""),
    })),
  ];

  const handleImagesChange = (newRefs: MediaRef[]) => {
    setPrompt((prev) =>
      rewritePromptMediaTags(prev, refImages, newRefs, "image"),
    );
    setRefImages(newRefs);
  };

  const handleVideosChange = (newRefs: MediaRef[]) => {
    setPrompt((prev) =>
      rewritePromptMediaTags(prev, refVideos, newRefs, "video"),
    );
    setRefVideos(newRefs);
  };

  const handleAudiosChange = (newRefs: MediaRef[]) => {
    setPrompt((prev) =>
      rewritePromptMediaTags(prev, refAudios, newRefs, "audio"),
    );
    setRefAudios(newRefs);
  };

  // Poll for active video generation result
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (result?.id && result?.status === "processing") {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/videos/${result.id}/sync`, {
            method: "POST",
          });
          if (!res.ok) return;

          const data = await res.json();
          if (data.status === "completed" || data.status === "failed") {
            setResult((prev: any) => ({ ...prev, ...data }));
            mutateHistory();
            clearInterval(intervalId);

            if (data.status === "completed") {
              toast.success("Video generation complete!");
            } else if (data.status === "failed") {
              toast.error("Video generation failed.");
            }
          }
        } catch (error) {
          console.error("Polling sync error:", error);
        }
      }, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [result?.id, result?.status, mutateHistory]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (
      inputMode === "reference" &&
      refAudios.length > 0 &&
      refImages.length === 0 &&
      refVideos.length === 0
    ) {
      toast.error("Audio refs require at least one image or video ref");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        prompt,
        inputMode,
        resolution,
        aspectRatio,
        duration,
      };

      if (inputMode === "keyframe") {
        if (startFrame)
          payload.startFrameUrl = await uploadFile(startFrame.file);
        if (endFrame) payload.endFrameUrl = await uploadFile(endFrame.file);
      } else {
        const [imgPaths, vidPaths, audPaths] = await Promise.all([
          Promise.all(refImages.map((r) => uploadFile(r.file))),
          Promise.all(refVideos.map((r) => uploadFile(r.file))),
          Promise.all(refAudios.map((r) => uploadFile(r.file))),
        ]);
        if (imgPaths.length) payload.referenceImages = imgPaths;
        if (vidPaths.length) payload.referenceVideos = vidPaths;
        if (audPaths.length) payload.referenceAudios = audPaths;
      }

      const res = await fetch("/api/videos/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Generation failed");
        return;
      }
      setResult(data);
      mutateHistory();
      if (data.status === "completed") toast.success("Video generated!");
      else if (data.status === "processing")
        toast.info("Video is being processed...");
      else toast.info(data.message || "Request saved");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="hero-gradient-purple">
      <section className="pt-12 pb-6 px-4">
        <div className="mx-auto max-w-[960px] text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/10 px-4 py-1.5 text-sm text-purple-400 mb-4">
            <Film className="h-3.5 w-3.5" /> Veo 1.0
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Video <span className="text-purple-400">Generator</span>
          </h1>
        </div>
      </section>

      <section className="pb-16 px-4">
        <div className="mx-auto max-w-[960px]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6">
            {/* Input panel */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
                {/* Mode tabs */}
                <div className="flex border-b border-border/50">
                  <ModeTab
                    active={inputMode === "keyframe"}
                    onClick={() => setInputMode("keyframe")}
                    icon={<Clapperboard className="h-3.5 w-3.5" />}
                    label="Keyframe"
                  />
                  <ModeTab
                    active={inputMode === "reference"}
                    onClick={() => setInputMode("reference")}
                    icon={<Layers className="h-3.5 w-3.5" />}
                    label="Reference"
                  />
                </div>

                <div className="p-5 space-y-4">
                  <AnimatePresence mode="wait">
                    {inputMode === "keyframe" ? (
                      <KeyframeInput
                        startFrame={startFrame}
                        endFrame={endFrame}
                        onStartFrameChange={setStartFrame}
                        onEndFrameChange={setEndFrame}
                      />
                    ) : (
                      <ReferenceInput
                        refImages={refImages}
                        refVideos={refVideos}
                        refAudios={refAudios}
                        onImagesChange={handleImagesChange}
                        onVideosChange={handleVideosChange}
                        onAudiosChange={handleAudiosChange}
                      />
                    )}
                  </AnimatePresence>

                  <MentionTextarea
                    value={prompt}
                    onChange={setPrompt}
                    placeholder="Describe the video you want to generate... Use @ to tag references and characters!"
                    mentionOptions={mentionOptions}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <VideoSettings
                      resolution={resolution}
                      aspectRatio={aspectRatio}
                      duration={duration}
                      onResolutionChange={setResolution}
                      onAspectRatioChange={setAspectRatio}
                      onDurationChange={setDuration}
                    />

                    <button
                      onClick={() => setCharModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-400/30 bg-purple-400/10 text-purple-400 text-xs font-medium hover:bg-purple-400/20 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Characters
                    </button>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />{" "}
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Generate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Result panel */}
            <ResultPanel
              loading={loading}
              result={result}
              history={history}
              onSelectHistory={setResult}
            />
          </div>
        </div>
      </section>

      <CharacterModal
        isOpen={charModalOpen}
        onClose={() => setCharModalOpen(false)}
        characters={characters}
        onRefresh={() => mutateChars()}
      />
    </div>
  );
}
