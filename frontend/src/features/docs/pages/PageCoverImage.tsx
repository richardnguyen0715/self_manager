"use client";

import * as React from "react";
import { ImagePlus, Loader2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUploadPageCover } from "@/features/docs";

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/** Resolve a cover_url to an absolute URL, handling /uploads/ paths. */
function resolveCoverUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PageCoverImageProps {
  pageId: string;
  /** The current cover URL or null. */
  coverUrl: string | null;
  /** Called when the cover changes (with new URL) or is removed (null). */
  onCoverChange: (url: string | null) => void;
  /** Read-only mode. */
  readOnly?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageCoverImage({
  pageId,
  coverUrl,
  onCoverChange,
  readOnly = false,
}: PageCoverImageProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const uploadMutation = useUploadPageCover(pageId);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are allowed.");
      return;
    }
    setUploadError(null);
    try {
      const result = await uploadMutation.mutateAsync(file);
      onCoverChange(result.url);
    } catch {
      setUploadError("Cover upload failed. Please try again.");
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  // ── Render: no cover yet ──────────────────────────────────────────────────

  if (!coverUrl) {
    if (readOnly) return null;

    return (
      <div
        className={cn(
          "group relative flex h-24 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-muted/20 transition-colors",
          isDragOver && "border-primary bg-primary/5",
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        aria-label="Add cover image"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        {uploadMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Add cover image</span>
          </div>
        )}

        {uploadError && (
          <p className="absolute bottom-2 left-2 text-xs text-destructive">
            {uploadError}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
          aria-hidden
        />
      </div>
    );
  }

  // ── Render: has cover ─────────────────────────────────────────────────────

  return (
    <div
      className="group relative h-52 w-full overflow-hidden rounded-lg"
      onDrop={!readOnly ? handleDrop : undefined}
      onDragOver={!readOnly ? handleDragOver : undefined}
      onDragLeave={!readOnly ? handleDragLeave : undefined}
    >
      {/* Cover image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveCoverUrl(coverUrl)}
        alt="Page cover"
        className="h-full w-full object-cover"
      />

      {/* Overlay with actions (edit mode only) */}
      {!readOnly && (
        <div className="absolute inset-0 flex items-end justify-end gap-2 p-3 opacity-0 transition-opacity group-hover:opacity-100 bg-gradient-to-t from-black/30 to-transparent">
          {/* Replace */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Change
          </Button>

          {/* Remove */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onCoverChange(null)}
            disabled={uploadMutation.isPending}
          >
            <X className="h-3 w-3" />
            Remove
          </Button>
        </div>
      )}

      {/* Drag overlay */}
      {isDragOver && !readOnly && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-primary bg-primary/20">
          <p className="text-sm font-medium text-primary">Drop to replace</p>
        </div>
      )}

      {uploadError && (
        <p className="absolute bottom-2 left-2 text-xs text-destructive bg-background/80 rounded px-1">
          {uploadError}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        aria-hidden
      />
    </div>
  );
}
