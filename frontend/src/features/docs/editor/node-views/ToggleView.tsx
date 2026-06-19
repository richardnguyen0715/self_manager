"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ToggleView — React node view for the Toggle (collapsible details) block.
 *
 * The node has two content "zones":
 *  - index 0 = toggleSummary  (the clickable heading row)
 *  - index 1+ = body blocks   (shown when open)
 *
 * TipTap's NodeViewContent renders ALL children in one slot, so we rely on
 * CSS to hide the body children when `open` is false.  The attribute is
 * toggled via `updateAttributes`.
 */
export function ToggleView({ node, updateAttributes, editor }: NodeViewProps) {
  const isOpen = node.attrs.open as boolean;
  const isEditable = editor.isEditable;

  const handleToggle = () => {
    if (isEditable) {
      updateAttributes({ open: !isOpen });
    }
  };

  return (
    <NodeViewWrapper>
      <div className="my-1 rounded-md border border-transparent hover:border-border/40 transition-colors">
        {/* Summary row */}
        <div
          className="flex items-start gap-1.5 py-1 px-1 cursor-pointer select-none"
          onClick={handleToggle}
          // Allow keyboard activation
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggle();
            }
          }}
          aria-expanded={isOpen}
        >
          <ChevronRight
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
              isOpen && "rotate-90",
            )}
          />
          {/* Summary content (first child of the node — toggleSummary) */}
          <div className="flex-1 min-w-0 font-medium">
            <NodeViewContent
              as="div"
              className="toggle-summary-content outline-none"
              // Stop click propagation so editing the summary doesn't toggle
              onClick={(e: React.MouseEvent) => {
                if (isEditable) e.stopPropagation();
              }}
            />
          </div>
        </div>

        {/* Body content (remaining children) */}
        {isOpen && (
          <div className="pl-6 pr-2 pb-1 border-t border-border/20 pt-1">
            <NodeViewContent as="div" className="toggle-body-content" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
