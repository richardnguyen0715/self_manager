"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Info, AlertTriangle, CheckCircle, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InfoPanelVariant } from "../extensions/InfoPanel";

const VARIANT_CONFIG: Record<
  InfoPanelVariant,
  { icon: React.ElementType; label: string; className: string; iconClass: string }
> = {
  info: {
    icon: Info,
    label: "Info",
    className:
      "border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30",
    iconClass: "text-blue-500",
  },
  note: {
    icon: StickyNote,
    label: "Note",
    className:
      "border-yellow-200 bg-yellow-50/60 dark:border-yellow-800 dark:bg-yellow-950/30",
    iconClass: "text-yellow-500",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    className:
      "border-orange-200 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-950/30",
    iconClass: "text-orange-500",
  },
  success: {
    icon: CheckCircle,
    label: "Success",
    className:
      "border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-950/30",
    iconClass: "text-green-500",
  },
};

const VARIANTS: InfoPanelVariant[] = ["info", "note", "warning", "success"];

export function InfoPanelView({
  node,
  updateAttributes,
  editor,
}: NodeViewProps) {
  const variant = (node.attrs.variant as InfoPanelVariant) ?? "info";
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info;
  const Icon = config.icon;
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "my-3 flex gap-3 rounded-lg border p-4",
          config.className,
        )}
      >
        <div className="flex flex-col items-start gap-1 pt-0.5">
          <Icon className={cn("h-4 w-4 shrink-0", config.iconClass)} />
          {isEditable && (
            <div className="flex flex-col gap-0.5 mt-1">
              {VARIANTS.map((v) => (
                <button
                  key={v}
                  title={v}
                  onClick={() => updateAttributes({ variant: v })}
                  className={cn(
                    "h-2 w-2 rounded-full border transition-transform hover:scale-125",
                    v === "info" && "border-blue-400 bg-blue-400",
                    v === "note" && "border-yellow-400 bg-yellow-400",
                    v === "warning" && "border-orange-400 bg-orange-400",
                    v === "success" && "border-green-400 bg-green-400",
                    variant === v && "ring-2 ring-offset-1 ring-current",
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <NodeViewContent className="prose-sm" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
