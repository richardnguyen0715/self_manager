"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Preset colors (same palette as ColorPicker in BoardColumn) ───────────────

const PRESET_COLORS = [
  "#94a3b8",
  "#8b5cf6",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#f97316",
  "#84cc16",
  "#14b8a6",
  "#ec4899",
  "#6366f1",
  "#a855f7",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onCreate: (payload: { name: string; color: string | null }) => void;
  isPending?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddColumnDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: AddColumnDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);

  if (!open) return null;

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, color });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onOpenChange(false);
  }

  function handleClose() {
    setName("");
    setColor(null);
    onOpenChange(false);
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={handleClose}
    >
      {/* Dialog */}
      <div
        className="bg-background border rounded-xl shadow-xl w-80 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-sm font-semibold">Add column</h2>

        {/* Name input */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Column name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ready to test"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Color picker */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Accent color{" "}
            <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(color === c ? null : c)}
                className={cn(
                  "h-5 w-5 rounded-full ring-offset-background transition-all hover:scale-110",
                  color === c && "ring-2 ring-primary ring-offset-1",
                )}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Create"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
