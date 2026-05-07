"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Upload, Loader2, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Character {
  id: string;
  name: string;
  description?: string;
  images: string[];
}

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  onRefresh: () => void;
}

export function CharacterModal({
  isOpen,
  onClose,
  characters,
  onRefresh,
}: CharacterModalProps) {
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingChar, setEditingChar] = useState<Character | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) setView("list");
  }, [isOpen]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

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
    if (signedHeaders.includes("content-disposition")) {
      headers["Content-Disposition"] = "attachment";
    }
    await fetch(uploadUrl, { method: "PUT", headers, body: file });
    return cloud_storage_path;
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name is required");

    if (view === "create") {
      if (images.length < 2)
        return toast.error("Minimum 2 images required for a character");

      const currentName = name;
      const currentDesc = description;
      const currentImages = images;

      toast.info(`Creating character "${currentName}" in background...`);
      setView("list");

      (async () => {
        let tempCharId: string | null = null;
        try {
          const initRes = await fetch("/api/characters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: currentName,
              description: currentDesc,
              images: [],
              status: "processing",
            }),
          });
          if (!initRes.ok) throw new Error(await initRes.text());
          const { character } = await initRes.json();
          tempCharId = character.id;

          const uploadedUrls = await Promise.all(currentImages.map(uploadFile));

          const res = await fetch(`/api/characters/${tempCharId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: uploadedUrls, status: "completed" }),
          });
          if (!res.ok) throw new Error(await res.text());

          toast.success(`Character "${currentName}" created!`);
          onRefresh();
        } catch (err) {
          if (tempCharId) {
            await fetch(`/api/characters/${tempCharId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "failed" }),
            }).catch(() => {});
          }
          toast.error(`Failed to create character "${currentName}"`);
        }
      })();
    } else if (view === "edit" && editingChar) {
      setLoading(true);
      try {
        const res = await fetch(`/api/characters/${editingChar.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Character updated!");
        onRefresh();
        setView("list");
      } catch (err) {
        toast.error("Failed to update character");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this character?")) return;
    try {
      const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Character deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete character");
    }
  };

  const startCreate = () => {
    setName("");
    setDescription("");
    setImages([]);
    setView("create");
  };

  const startEdit = (char: Character, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChar(char);
    setName(char.name);
    setDescription(char.description || "");
    setView("edit");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-[#1c1c21] rounded-2xl shadow-xl overflow-hidden border border-border/50 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== "list" && (
              <button
                onClick={() => setView("list")}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ← Back
              </button>
            )}
            <h2 className="text-lg font-bold">
              {view === "list"
                ? "Characters"
                : view === "create"
                  ? "New Character"
                  : "Edit Character"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {view === "list" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {/* Create New Card */}
              <button
                onClick={startCreate}
                className="aspect-square rounded-xl border-2 border-dashed border-border/50 bg-background/30 hover:bg-background/50 hover:border-purple-400/50 transition-colors flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-10 h-10 rounded-full bg-purple-400/10 flex items-center justify-center group-hover:bg-purple-400/20 text-purple-400 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                  Create New
                </span>
              </button>

              {/* Character Cards */}
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="relative aspect-square rounded-xl overflow-hidden border border-border/50 group bg-card"
                >
                  {char.images?.[0] && (
                    <img
                      src={char.images[0]}
                      alt={char.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                    <span className="font-semibold text-white text-sm truncate">
                      {char.name}
                    </span>
                  </div>
                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-end p-2 gap-2">
                    <button
                      onClick={(e) => startEdit(char, e)}
                      className="p-1.5 rounded-md bg-black/60 text-white hover:bg-purple-500 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(char.id, e)}
                      className="p-1.5 rounded-md bg-black/60 text-white hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(view === "create" || view === "edit") && (
            <div className="space-y-6">
              {view === "create" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Upload Images (Min 5)
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed border-border/50 bg-background/30 hover:bg-background/50 flex flex-col items-center justify-center cursor-pointer transition-colors"
                  >
                    <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Click or drag images here
                    </span>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {images.map((img, i) => (
                        <div
                          key={i}
                          className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/50 group"
                        >
                          <img
                            src={URL.createObjectURL(img)}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(i);
                            }}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {images.length} image(s) selected.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    Character Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border/50 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl bg-background border border-border/50 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {view === "create" ? "Create Character" : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
