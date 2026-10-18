"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/stores";
import { useWorkItemUIStore } from "@/features/workitems/store";
import { useSprintUIStore } from "@/features/sprints/store";
import {
  SHORTCUTS,
  SHORTCUTS_MODAL_ID,
  type ShortcutAction,
} from "./shortcuts";

const CHORD_TIMEOUT_MS = 1200;

/** Pages that open their create dialog when visited with `?new=1`. */
const CREATE_ROUTES = {
  "work-item": "/work-items",
  sprint: "/sprints",
} as const;

type CreateKind = keyof typeof CREATE_ROUTES;

/** First keys of every two-key chord, e.g. "g" and "n". */
const CHORD_PREFIXES = new Set(
  SHORTCUTS.filter((s) => s.sequence).map((s) => s.sequence!.charAt(0)),
);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function isAnotherDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}

function openCreate(kind: CreateKind, pathname: string, navigate: (href: string) => void) {
  const route = CREATE_ROUTES[kind];
  if (pathname === route) {
    if (kind === "work-item") useWorkItemUIStore.getState().openCreateDialog();
    else useSprintUIStore.getState().openCreateDialog();
  } else {
    navigate(`${route}?new=1`);
  }
}

/**
 * Global Plane-style keyboard shortcuts (chords like G then B, N then W, ?).
 * Mount once in the app shell. Ignores keys while typing in form fields,
 * while a modifier is held, or while another dialog/palette is open.
 */
export function useGlobalHotkeys() {
  const router = useRouter();
  const pathname = usePathname();
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  // Arrival handler: pages reached via `?new=1` open their create dialog.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;

    const kind = (Object.keys(CREATE_ROUTES) as CreateKind[]).find(
      (k) => CREATE_ROUTES[k] === pathname,
    );
    if (!kind) return;

    if (kind === "work-item") useWorkItemUIStore.getState().openCreateDialog();
    else useSprintUIStore.getState().openCreateDialog();

    params.delete("new");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router]);

  // Keydown handler
  useEffect(() => {
    const clearChord = () => {
      pendingRef.current = null;
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };

    const run = (action: ShortcutAction) => {
      switch (action.type) {
        case "navigate":
          router.push(action.href);
          break;
        case "create":
          openCreate(action.kind, pathname, (href) => router.push(href));
          break;
        case "open-shortcuts":
          useUIStore.getState().openModal(SHORTCUTS_MODAL_ID);
          break;
        case "open-command-palette":
          useUIStore.getState().openCommandPalette();
          break;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+/ opens the shortcuts dialog from anywhere, including inputs.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === "/") {
        e.preventDefault();
        useUIStore.getState().openModal(SHORTCUTS_MODAL_ID);
        clearChord();
        return;
      }

      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;

      const ui = useUIStore.getState();
      if (ui.commandPaletteOpen) return;

      // `?` (Shift+/) toggles the dialog; it is the only key allowed with Shift.
      if (e.key === "?") {
        if (ui.activeModal === SHORTCUTS_MODAL_ID) {
          ui.closeModal();
        } else if (!isAnotherDialogOpen()) {
          ui.openModal(SHORTCUTS_MODAL_ID);
        } else {
          return;
        }
        clearChord();
        e.preventDefault();
        return;
      }

      if (e.shiftKey) return;
      if (isAnotherDialogOpen()) return;

      if (!/^[a-z]$/.test(e.key)) {
        clearChord();
        return;
      }

      if (pendingRef.current) {
        const sequence = pendingRef.current + e.key;
        clearChord();
        const match = SHORTCUTS.find((s) => s.sequence === sequence);
        if (match?.action) {
          e.preventDefault();
          run(match.action);
          return;
        }
        // Fall through: the key may start a new chord.
      }

      if (CHORD_PREFIXES.has(e.key)) {
        pendingRef.current = e.key;
        timerRef.current = window.setTimeout(clearChord, CHORD_TIMEOUT_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearChord();
    };
  }, [router, pathname]);
}
