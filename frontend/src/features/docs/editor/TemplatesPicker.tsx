"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DOC_TEMPLATES } from "./templates";
import type { TipTapDoc } from "@/types";
import { FileText, ClipboardList, RotateCcw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const ICONS: Record<string, React.ElementType> = {
  blank: FileText,
  "1on1": Users,
  "4ls": ClipboardList,
  "5whys": RotateCcw,
};

interface TemplatesPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: TipTapDoc) => void;
}

export function TemplatesPicker({ open, onClose, onSelect }: TemplatesPickerProps) {
  const [selected, setSelected] = useState<string>("blank");

  const handleApply = () => {
    const tmpl = DOC_TEMPLATES.find((t) => t.id === selected);
    if (tmpl) {
      onSelect(tmpl.content);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            Start your page from a preset layout or pick blank to begin from scratch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2">
          {DOC_TEMPLATES.map((tmpl) => {
            const Icon = ICONS[tmpl.id] ?? FileText;
            const isSelected = selected === tmpl.id;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setSelected(tmpl.id)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/40 hover:bg-accent/40",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded",
                      isSelected ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </span>
                  <span className="font-medium text-sm">{tmpl.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {tmpl.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            Use template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
