"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── UrlDialog ─────────────────────────────────────────────────────────────────
// A small controlled dialog for entering a URL.
//
// Usage:
//   <UrlDialog
//     open={open}
//     title="Insert Link"
//     label="URL"
//     placeholder="https://"
//     initialValue={currentHref}
//     onConfirm={(url) => { /* url === "" means unset */ }}
//     onCancel={() => setOpen(false)}
//     allowClear   // shows a "Remove" button when initialValue is non-empty
//   />

export interface UrlDialogProps {
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  /** Called with the entered URL (or "" if the user cleared it and confirmed). */
  onConfirm: (url: string) => void;
  onCancel: () => void;
  /** When true and initialValue is non-empty, shows a "Remove" button. */
  allowClear?: boolean;
}

export function UrlDialog({
  open,
  title,
  label = "URL",
  placeholder = "https://",
  initialValue = "",
  onConfirm,
  onCancel,
  allowClear = false,
}: UrlDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value whenever dialog opens with a new initial value.
  useEffect(() => {
    if (open) {
      setValue(initialValue);
      // Defer focus so the dialog animation doesn't swallow it.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialValue]);

  const handleConfirm = () => {
    onConfirm(value.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2 py-1">
          <Label htmlFor="url-dialog-input">{label}</Label>
          <Input
            id="url-dialog-input"
            ref={inputRef}
            type="url"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <DialogFooter className="gap-2">
          {allowClear && initialValue && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={() => onConfirm("")}
            >
              Remove
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
