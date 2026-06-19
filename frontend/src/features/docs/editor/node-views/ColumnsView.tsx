"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export function ColumnsView({ node: _node }: NodeViewProps) {
  return (
    <NodeViewWrapper>
      <div className="my-3 grid grid-cols-2 gap-4">
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}
