"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Pencil, Eye, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

let mermaidInitialized = false;

async function initMermaid() {
  if (mermaidInitialized) return;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
  });
  mermaidInitialized = true;
}

let renderCounter = 0;

export function MermaidView({ node, updateAttributes, editor }: NodeViewProps) {
  const code = (node.attrs.code as string) ?? "";
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(code);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${++renderCounter}`);
  const isEditable = editor.isEditable;

  const renderDiagram = useCallback(async (src: string) => {
    setError(null);
    try {
      await initMermaid();
      const mermaid = (await import("mermaid")).default;
      const id = idRef.current;
      const { svg: rendered } = await mermaid.render(id, src);
      setSvg(rendered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagram error");
    }
  }, []);

  useEffect(() => {
    void renderDiagram(code);
  }, [code, renderDiagram]);

  const handleSave = () => {
    updateAttributes({ code: draft });
    setIsEditing(false);
    void renderDiagram(draft);
  };

  const handleCancel = () => {
    setDraft(code);
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper>
      <div className="my-3 rounded-lg border bg-muted/30 overflow-hidden">
        {/* Toolbar */}
        {isEditable && (
          <div className="flex items-center justify-end gap-1 border-b bg-muted/50 px-2 py-1">
            <button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
                isEditing
                  ? "bg-primary text-primary-foreground hover:bg-primary/80"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground",
              )}
            >
              {isEditing ? (
                <>
                  <Eye className="h-3 w-3" />
                  Preview
                </>
              ) : (
                <>
                  <Pencil className="h-3 w-3" />
                  Edit
                </>
              )}
            </button>
            {isEditing && (
              <button
                onClick={handleCancel}
                className="rounded px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Code editor */}
        {isEditing && (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full resize-none bg-muted/40 p-3 font-mono text-xs focus:outline-none min-h-[120px]"
            spellCheck={false}
            autoFocus
          />
        )}

        {/* Rendered diagram */}
        {!isEditing && (
          <div className="flex items-center justify-center p-4" ref={containerRef}>
            {error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-mono text-xs break-all">{error}</span>
              </div>
            ) : svg ? (
              <div
                className="mermaid-output max-w-full overflow-auto"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="text-xs text-muted-foreground animate-pulse">
                Rendering diagram…
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
