"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useFocusStore } from "../store";
import type { FocusMode } from "../types";
import { FOCUS_MODES } from "../types";

export function ModeSelector() {
  const selectedMode = useFocusStore((s) => s.selectedMode);
  const phase = useFocusStore((s) => s.phase);
  const customWorkMinutes = useFocusStore((s) => s.customWorkMinutes);
  const customBreakMinutes = useFocusStore((s) => s.customBreakMinutes);
  const setSelectedMode = useFocusStore((s) => s.setSelectedMode);
  const setCustomMinutes = useFocusStore((s) => s.setCustomMinutes);

  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [draftWork, setDraftWork] = useState(String(customWorkMinutes));
  const [draftBreak, setDraftBreak] = useState(String(customBreakMinutes));

  const isDisabled = phase === "work" || phase === "break";

  function handleSelect(mode: FocusMode) {
    if (isDisabled) return;
    if (mode === "custom") {
      setDraftWork(String(customWorkMinutes));
      setDraftBreak(String(customBreakMinutes));
      setCustomDialogOpen(true);
    } else {
      setSelectedMode(mode);
    }
  }

  function handleCustomSave() {
    const work = Math.max(1, Math.min(120, parseInt(draftWork, 10) || 25));
    const breakMins = Math.max(1, Math.min(60, parseInt(draftBreak, 10) || 5));
    setCustomMinutes(work, breakMins);
    setSelectedMode("custom");
    setCustomDialogOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-2" role="group" aria-label="Focus mode">
        {FOCUS_MODES.map((cfg) => {
          const isActive = selectedMode === cfg.mode;
          const subtitle =
            cfg.mode === "custom"
              ? `${customWorkMinutes}/${customBreakMinutes}`
              : `${cfg.workMinutes}/${cfg.breakMinutes}`;

          return (
            <button
              key={cfg.mode}
              onClick={() => handleSelect(cfg.mode)}
              disabled={isDisabled}
              aria-pressed={isActive}
              className={cn(
                "flex flex-col items-center rounded-xl border px-4 py-2.5 text-center text-sm transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
                isActive
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              <span className="font-medium">{cfg.label}</span>
              <span className="text-xs opacity-70">{subtitle} min</span>
            </button>
          );
        })}
      </div>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Custom Timer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="custom-work">Work (min)</Label>
              <Input
                id="custom-work"
                type="number"
                min={1}
                max={120}
                value={draftWork}
                onChange={(e) => setDraftWork(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-break">Break (min)</Label>
              <Input
                id="custom-break"
                type="number"
                min={1}
                max={60}
                value={draftBreak}
                onChange={(e) => setDraftBreak(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
