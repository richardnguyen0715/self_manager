"use client";

import * as React from "react";
import { create } from "zustand";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Public API types ─────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

// ─── Internal store state ─────────────────────────────────────────────────────

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmStore {
  request: ConfirmRequest | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  _resolve: (value: boolean) => void;
}

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  request: null,

  ask(opts) {
    return new Promise<boolean>((resolve) => {
      set({ request: { ...opts, resolve } });
    });
  },

  _resolve(value) {
    const { request } = get();
    if (request) {
      request.resolve(value);
      set({ request: null });
    }
  },
}));

// ─── Public hook ──────────────────────────────────────────────────────────────

/**
 * Returns an async `confirm` function that shows a styled in-app dialog.
 *
 * Usage (call at component top level):
 *   const confirm = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Delete?", destructive: true }))) return;
 */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ask = useConfirmStore((s) => s.ask);
  return ask;
}

// ─── Global singleton dialog ──────────────────────────────────────────────────

/**
 * Mount once inside <Providers> (or any app-level layout) so the dialog is
 * always available regardless of which component triggers it.
 */
export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const _resolve = useConfirmStore((s) => s._resolve);

  const open = request !== null;

  const title = request?.title ?? "Are you sure?";
  const description = request?.description;
  const confirmText = request?.confirmText ?? "Confirm";
  const cancelText = request?.cancelText ?? "Cancel";
  const destructive = request?.destructive ?? false;

  // Prevent Radix from closing via overlay-click / Escape before we resolve
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) _resolve(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => _resolve(false)}
          >
            {cancelText}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => _resolve(true)}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
