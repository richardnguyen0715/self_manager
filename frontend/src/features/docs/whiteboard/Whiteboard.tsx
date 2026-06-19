"use client";

/**
 * Whiteboard — Excalidraw-backed page editor for pages with kind='whiteboard'.
 *
 * Ownership: whiteboard agent — features/docs/whiteboard/
 *
 * Responsibilities:
 *  - Loads the full page via usePage (includes pages.excalidraw JSON).
 *  - Renders ExcalidrawWrapper (dynamically imported, ssr:false).
 *  - Autosaves scene changes to the backend via useUpdatePage (debounced
 *    1 500 ms to reduce API calls while the user draws).
 *  - Exposes a title bar matching the design system (muted header, page title,
 *    last-saved indicator) but does NOT touch the layout sidebar — that is the
 *    shell agent's concern.
 *
 * Usage (routes agent will call this):
 *   <Whiteboard pageId="<uuid>" readOnly={false} />
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, PenLine, Save, CheckCheck } from "lucide-react";
import { usePage, useUpdatePage } from "@/features/docs";
import type { ExcalidrawScene } from "@/features/docs";

// ── Dynamic import — Excalidraw is browser-only ────────────────────────────────

const ExcalidrawWrapper = dynamic(
  () => import("./ExcalidrawWrapper"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

// ── Autosave debounce duration (ms) ───────────────────────────────────────────

const AUTOSAVE_DEBOUNCE_MS = 1500;

// ── Save status ───────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─────────────────────────────────────────────────────────────────────────────

interface WhiteboardProps {
  /** UUID of the page (kind must be 'whiteboard'). */
  pageId: string;
  /** When true the canvas is rendered in view-only mode (no editing). */
  readOnly?: boolean;
}

export function Whiteboard({ pageId, readOnly = false }: WhiteboardProps) {
  // ── Data ─────────────────────────────────────────────────────────────────────

  const { data: page, isLoading, isError } = usePage(pageId);
  const updatePage = useUpdatePage(pageId);

  // ── Autosave state ───────────────────────────────────────────────────────────

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store the latest pending scene so the debounce flush always uses the most
  // recent snapshot, not a stale closure value.
  const pendingScene = useRef<ExcalidrawScene | null>(null);

  // Clear the timer on unmount to avoid state updates on an unmounted component.
  useEffect(() => {
    return () => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // ── Scene change handler ─────────────────────────────────────────────────────

  const handleSceneChange = useCallback(
    (scene: ExcalidrawScene) => {
      if (readOnly) return;

      pendingScene.current = scene;

      // Debounce: reset the timer on every change
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }

      setSaveStatus("idle");

      debounceTimer.current = setTimeout(() => {
        const sceneSnapshot = pendingScene.current;
        if (!sceneSnapshot) return;

        setSaveStatus("saving");

        updatePage.mutate(
          { excalidraw: sceneSnapshot },
          {
            onSuccess: () => {
              setSaveStatus("saved");
              // Reset back to idle after a short visual confirmation
              setTimeout(() => setSaveStatus("idle"), 2000);
            },
            onError: () => {
              setSaveStatus("error");
            },
          },
        );
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [readOnly, updatePage],
  );

  // ── Loading / error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col">
        <WhiteboardHeader title="" saveStatus="idle" readOnly={readOnly} loading />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="flex h-full w-full flex-col">
        <WhiteboardHeader title="" saveStatus="idle" readOnly={readOnly} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-destructive">
            Failed to load whiteboard. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  // Guard: this component is only meaningful for whiteboard pages
  if (page.kind !== "whiteboard") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          This page is not a whiteboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <WhiteboardHeader
        title={page.title}
        saveStatus={saveStatus}
        readOnly={readOnly}
      />

      {/* Canvas area — fills remaining height */}
      <div className="relative flex-1 overflow-hidden">
        <ExcalidrawWrapper
          initialScene={page.excalidraw ?? null}
          onChange={handleSceneChange}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}

// ─── WhiteboardHeader ─────────────────────────────────────────────────────────

interface WhiteboardHeaderProps {
  title: string;
  saveStatus: SaveStatus;
  readOnly: boolean;
  loading?: boolean;
}

function WhiteboardHeader({
  title,
  saveStatus,
  readOnly,
  loading = false,
}: WhiteboardHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b bg-background px-4">
      {/* Left: icon + title */}
      <div className="flex items-center gap-2 min-w-0">
        <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
        {loading ? (
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        ) : (
          <span className="truncate text-sm font-medium text-foreground">
            {title || "Untitled Whiteboard"}
          </span>
        )}
        {readOnly && (
          <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            read-only
          </span>
        )}
      </div>

      {/* Right: autosave status */}
      {!readOnly && (
        <SaveIndicator status={saveStatus} />
      )}
    </div>
  );
}

// ─── SaveIndicator ────────────────────────────────────────────────────────────

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Save className="h-3 w-3 animate-pulse" />
        Saving…
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCheck className="h-3 w-3 text-green-600" />
        Saved
      </span>
    );
  }

  // error
  return (
    <span className="text-xs text-destructive">
      Save failed — check your connection.
    </span>
  );
}
