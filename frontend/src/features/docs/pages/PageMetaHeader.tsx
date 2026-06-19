"use client";

/**
 * PageMetaHeader — The Notion-style page header shown above the TipTap editor.
 *
 * Contains:
 * - PageCoverImage: full-width cover photo (upload/drag-drop)
 * - PageIconPicker: emoji icon shown above the title
 * - Editable title input
 * - Inline "Add icon" and "Add cover" prompt links when neither is set
 * - A row of meta-action buttons (Backlinks, Publish toggle) in a right drawer
 *
 * This component is consumed inside `DocsPageEditorPage`.
 */

import * as React from "react";
import { ImagePlus, Smile, LinkIcon, Globe, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUpdatePage } from "@/features/docs";
import type { Page, TipTapDoc } from "@/types";

import { PageIconPicker } from "./PageIconPicker";
import { PageCoverImage } from "./PageCoverImage";
import { BacklinksPanel } from "./BacklinksPanel";
import { PublishToggle } from "./PublishToggle";

// ── Side panel tab ────────────────────────────────────────────────────────────

type MetaPanel = "backlinks" | "publish" | null;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PageMetaHeaderProps {
  page: Page;
  spaceId: string;
  /** Debounced title change handler from the parent. */
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Title display value (may be a local draft). */
  titleValue: string;
  /** Called when the DocEditor content changes (passed through). */
  onCoverChange?: (url: string | null) => void;
  /** Whether we're in read-only mode (published view). */
  readOnly?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageMetaHeader({
  page,
  spaceId,
  onTitleChange,
  titleValue,
  onCoverChange,
  readOnly = false,
  className,
}: PageMetaHeaderProps) {
  const updatePage = useUpdatePage(page.id);

  const [metaPanel, setMetaPanel] = React.useState<MetaPanel>(null);

  // Local optimistic state for icon & cover (synced to Page data)
  const [localIcon, setLocalIcon] = React.useState<string | null>(page.icon);
  const [localCover, setLocalCover] = React.useState<string | null>(page.cover_url);

  // Sync server state changes in (e.g. after upload mutation)
  React.useEffect(() => {
    setLocalIcon(page.icon);
  }, [page.icon]);

  React.useEffect(() => {
    setLocalCover(page.cover_url);
  }, [page.cover_url]);

  // ── Icon change ────────────────────────────────────────────────────────────
  function handleIconChange(emoji: string | null) {
    setLocalIcon(emoji);
    updatePage.mutate({ icon: emoji });
  }

  // ── Cover change ───────────────────────────────────────────────────────────
  function handleCoverChange(url: string | null) {
    setLocalCover(url);
    if (url === null) {
      // Clearing cover — persist via PATCH
      updatePage.mutate({ cover_url: null });
    }
    // Upload sets cover via its own mutation (useUploadPageCover), which also
    // updates the cache. We still update local state for optimistic render.
    onCoverChange?.(url);
  }

  // ── Panel toggle ────────────────────────────────────────────────────────────
  function togglePanel(panel: MetaPanel) {
    setMetaPanel((cur) => (cur === panel ? null : panel));
  }

  const hasIcon = localIcon !== null;
  const hasCover = localCover !== null;
  const isWhiteboard = page.kind === "whiteboard";

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Cover image area */}
      {!isWhiteboard && (
        <PageCoverImage
          pageId={page.id}
          coverUrl={localCover}
          onCoverChange={handleCoverChange}
          readOnly={readOnly}
        />
      )}

      {/* Icon + title area */}
      {!isWhiteboard && (
        <div className="px-8 pt-4 pb-2">
          {/* Icon row — icon picker above title */}
          <div className="flex items-start gap-3 mb-2">
            {(hasIcon || !readOnly) && (
              <PageIconPicker
                value={localIcon}
                onChange={handleIconChange}
                disabled={readOnly}
              />
            )}

            {/* Add prompts — shown only in edit mode when no icon/cover */}
            {!readOnly && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {!hasIcon && (
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger the picker — PageIconPicker handles its own state,
                      // so we just focus the trigger. The user can also click the
                      // Smile icon directly.
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <Smile className="h-3.5 w-3.5" />
                    Add icon
                  </button>
                )}
                {!hasCover && (
                  <span className="text-xs text-muted-foreground/30">·</span>
                )}
                {!hasCover && (
                  <button
                    type="button"
                    onClick={() => {
                      // The PageCoverImage component handles upload when clicking
                      // its own trigger. This is a visual shortcut pointing there.
                      const coverEl = document.getElementById(`cover-trigger-${page.id}`);
                      coverEl?.click();
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Add cover
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Title input */}
          <input
            className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            placeholder="Untitled"
            value={titleValue}
            onChange={onTitleChange}
            maxLength={500}
            aria-label="Page title"
            readOnly={readOnly}
            disabled={readOnly}
          />

          {/* Meta info row: updated_at + action buttons */}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground shrink-0">
              {page.published_at
                ? `Published ${new Date(page.published_at).toLocaleDateString()}`
                : `Last updated ${new Date(page.updated_at).toLocaleDateString()}`}
            </p>

            {!readOnly && (
              <>
                <Separator orientation="vertical" className="h-3" />

                {/* Backlinks button */}
                <button
                  type="button"
                  onClick={() => togglePanel("backlinks")}
                  className={cn(
                    "flex items-center gap-1 text-xs transition-colors",
                    metaPanel === "backlinks"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Backlinks"
                >
                  <LinkIcon className="h-3 w-3" />
                  Backlinks
                </button>

                {/* Publish toggle button */}
                <button
                  type="button"
                  onClick={() => togglePanel("publish")}
                  className={cn(
                    "flex items-center gap-1 text-xs transition-colors",
                    metaPanel === "publish"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                    page.is_public && "text-green-600 hover:text-green-700",
                  )}
                  title={page.is_public ? "Published to web" : "Publish to web"}
                >
                  <Globe className="h-3 w-3" />
                  {page.is_public ? "Public" : "Publish"}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Inline meta panel — collapses below the header */}
      {metaPanel !== null && !readOnly && (
        <div className="mx-8 mb-2 rounded-lg border bg-card/80 backdrop-blur-sm shadow-sm">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <span className="text-sm font-medium capitalize">
              {metaPanel === "backlinks" ? "Backlinks" : "Publish to web"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setMetaPanel(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Panel body */}
          <div className="p-4">
            {metaPanel === "backlinks" && (
              <BacklinksPanel pageId={page.id} spaceId={spaceId} />
            )}
            {metaPanel === "publish" && (
              <PublishToggle page={page} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
