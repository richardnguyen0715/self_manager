"use client";

/**
 * ExcalidrawWrapper — thin client-only wrapper around @excalidraw/excalidraw.
 *
 * This file is always rendered via next/dynamic with ssr:false from
 * Whiteboard.tsx, so it is safe to directly import Excalidraw here without
 * guards.
 *
 * Types are inlined / loosely typed where the package does not guarantee a
 * stable deep-import path across 0.17.x patch releases.  The Excalidraw prop
 * types are used structurally (duck-typed), so this is safe.
 */

import React, { useCallback } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawScene } from "@/features/docs";

// ── Loose structural types matching Excalidraw 0.17.x public API ──────────────

/** Minimal ExcalidrawElement shape for the onChange signature. */
type AnyExcalidrawElement = Record<string, unknown>;

/** Minimal AppState fields we persist (only the subset we care about). */
interface PartialAppState {
  viewBackgroundColor?: string;
  currentItemFontFamily?: number;
  currentItemFontSize?: number;
  currentItemStrokeColor?: string;
  currentItemBackgroundColor?: string;
  currentItemOpacity?: number;
  currentItemStrokeWidth?: number;
  currentItemRoughness?: number;
  currentItemStrokeStyle?: string;
  currentItemStartArrowhead?: string | null;
  currentItemEndArrowhead?: string | null;
  gridSize?: number | null;
  theme?: string;
  zoom?: { value: number };
  scrollX?: number;
  scrollY?: number;
  [key: string]: unknown;
}

/** BinaryFiles is a Record of id → { mimeType, dataURL }. */
type BinaryFiles = Record<string, { mimeType: string; dataURL: string }>;

/** The imperative API ref shape Excalidraw exposes. */
type ExcalidrawImperativeAPI = {
  getSceneElements: () => AnyExcalidrawElement[];
  getAppState: () => PartialAppState;
  [key: string]: unknown;
};

interface ExcalidrawWrapperProps {
  /** The Excalidraw scene JSON stored in `pages.excalidraw`. May be null/empty on a brand-new whiteboard page. */
  initialScene: ExcalidrawScene | null;
  /** Called (debounced by parent) whenever the scene changes. */
  onChange: (scene: ExcalidrawScene) => void;
  /** Passes back the imperative API ref so the parent can call scene helpers if needed. */
  onMount?: (api: ExcalidrawImperativeAPI) => void;
  /** Whether the whiteboard is in read-only (published view) mode. */
  readOnly?: boolean;
}

/**
 * Normalise a raw ExcalidrawScene (which is typed as Record<string, unknown>)
 * into the shape Excalidraw's initialData expects.  Unknown / missing keys are
 * safely defaulted to empty values so we never crash on a blank page.
 */
function sceneToInitialData(scene: ExcalidrawScene | null) {
  if (!scene || Object.keys(scene).length === 0) {
    return { elements: [], appState: {}, files: {} };
  }
  return {
    elements: (scene.elements ?? []) as AnyExcalidrawElement[],
    appState: (scene.appState ?? {}) as PartialAppState,
    files: (scene.files ?? {}) as BinaryFiles,
  };
}

export default function ExcalidrawWrapper({
  initialScene,
  onChange,
  onMount,
  readOnly = false,
}: ExcalidrawWrapperProps) {
  const handleChange = useCallback(
    (
      elements: readonly AnyExcalidrawElement[],
      appState: PartialAppState,
      files: BinaryFiles,
    ) => {
      // Collapse scene into the opaque Record<string, unknown> shape we store.
      // We deliberately omit transient UI state (openMenu, cursorButton, etc.)
      // to avoid saving unnecessary churn.  Only elements + relevant appState
      // fields + files are persisted.
      const scene: ExcalidrawScene = {
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          currentItemFontFamily: appState.currentItemFontFamily,
          currentItemFontSize: appState.currentItemFontSize,
          currentItemStrokeColor: appState.currentItemStrokeColor,
          currentItemBackgroundColor: appState.currentItemBackgroundColor,
          currentItemOpacity: appState.currentItemOpacity,
          currentItemStrokeWidth: appState.currentItemStrokeWidth,
          currentItemRoughness: appState.currentItemRoughness,
          currentItemStrokeStyle: appState.currentItemStrokeStyle,
          currentItemStartArrowhead: appState.currentItemStartArrowhead,
          currentItemEndArrowhead: appState.currentItemEndArrowhead,
          gridSize: appState.gridSize,
          theme: appState.theme,
          zoom: appState.zoom,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        },
        files,
      };
      onChange(scene);
    },
    [onChange],
  );

  const initialData = sceneToInitialData(initialScene);

  return (
    <div className="h-full w-full">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Excalidraw
        initialData={initialData as any}
        onChange={handleChange as any}
        excalidrawAPI={onMount as any}
        viewModeEnabled={readOnly}
        // UIOptions — keep the UI clean within the app shell
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: { saveFileToDisk: true },
            saveToActiveFile: false,
          },
        }}
      />
    </div>
  );
}
