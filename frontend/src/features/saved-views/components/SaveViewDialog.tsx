"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "Save view" or "Rename view". */
  title: string;
  initialName?: string;
  submitLabel?: string;
  isPending?: boolean;
  onSubmit: (name: string) => void;
}

/** Small name-prompt dialog used for both saving and renaming a view. */
export function SaveViewDialog({
  open,
  onOpenChange,
  title,
  initialName = "",
  submitLabel = "Save",
  isPending,
  onSubmit,
}: SaveViewDialogProps) {
  const [name, setName] = useState(initialName);

  // Reset the field each time the dialog opens with a fresh initial name.
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const trimmed = name.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || isPending) return;
    onSubmit(trimmed);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My open bugs"
            aria-label="View name"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!trimmed || isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
