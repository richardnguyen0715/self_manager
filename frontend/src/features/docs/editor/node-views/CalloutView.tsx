"use client";

import { useState } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";
import type { CalloutVariant } from "../extensions/Callout";

const VARIANT_STYLES: Record<CalloutVariant, string> = {
  info: "border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30",
  note: "border-yellow-200 bg-yellow-50/60 dark:border-yellow-800 dark:bg-yellow-950/30",
  warning: "border-orange-200 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-950/30",
  success: "border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-950/30",
  error: "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/30",
};

const VARIANT_LABELS: Record<CalloutVariant, string> = {
  info: "Info",
  note: "Note",
  warning: "Warning",
  success: "Success",
  error: "Error",
};

const VARIANT_DOT_STYLES: Record<CalloutVariant, string> = {
  info: "border-blue-400 bg-blue-400",
  note: "border-yellow-400 bg-yellow-400",
  warning: "border-orange-400 bg-orange-400",
  success: "border-green-400 bg-green-400",
  error: "border-red-400 bg-red-400",
};

const ALL_VARIANTS: CalloutVariant[] = ["info", "note", "warning", "success", "error"];

const COMMON_EMOJIS = ["💡", "ℹ️", "⚠️", "✅", "❌", "🔥", "📌", "🚀", "💬", "🎯", "📝", "⚡"];

export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const variant = (node.attrs.variant as CalloutVariant) ?? "info";
  const emoji = (node.attrs.emoji as string) ?? "💡";
  const isEditable = editor.isEditable;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVariantPicker, setShowVariantPicker] = useState(false);

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "my-3 flex gap-3 rounded-lg border p-4",
          VARIANT_STYLES[variant] ?? VARIANT_STYLES.info,
        )}
      >
        {/* Emoji icon + pickers */}
        <div className="relative flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <button
            type="button"
            contentEditable={false}
            disabled={!isEditable}
            onClick={() => {
              if (isEditable) {
                setShowEmojiPicker((o) => !o);
                setShowVariantPicker(false);
              }
            }}
            className={cn(
              "text-lg leading-none transition-transform",
              isEditable && "cursor-pointer hover:scale-110 select-none",
            )}
            title={isEditable ? "Change emoji" : undefined}
          >
            {emoji}
          </button>

          {/* Variant dot buttons */}
          {isEditable && (
            <div className="flex flex-col gap-0.5">
              {ALL_VARIANTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  contentEditable={false}
                  title={VARIANT_LABELS[v]}
                  onClick={() => updateAttributes({ variant: v })}
                  className={cn(
                    "h-2 w-2 rounded-full border transition-transform hover:scale-125",
                    VARIANT_DOT_STYLES[v],
                    variant === v && "ring-2 ring-offset-1 ring-current",
                  )}
                />
              ))}
            </div>
          )}

          {/* Emoji picker popup */}
          {showEmojiPicker && (
            <div
              contentEditable={false}
              className="absolute left-8 top-0 z-50 flex flex-wrap gap-1 rounded-lg border bg-popover p-2 shadow-lg w-40"
            >
              {COMMON_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    updateAttributes({ emoji: e });
                    setShowEmojiPicker(false);
                  }}
                  className="text-base hover:scale-110 transition-transform cursor-pointer"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <NodeViewContent className="prose-sm" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
