"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

const LANGUAGES = [
  { value: "plaintext", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "tsx", label: "TSX" },
  { value: "jsx", label: "JSX" },
  { value: "json", label: "JSON" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "bash", label: "Bash" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
] as const;

export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string) || "plaintext";
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper>
      <div className="code-block-wrapper my-3 relative">
        {/* Language selector — top-right corner */}
        <div
          contentEditable={false}
          className="absolute right-2 top-2 z-10 select-none"
        >
          <select
            value={language}
            disabled={!isEditable}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            className="rounded border border-border/40 bg-muted/80 px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-default cursor-pointer"
            aria-label="Code block language"
          >
            {LANGUAGES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* The pre > code — NodeViewContent renders the editable code content */}
        <pre className="overflow-x-auto rounded-lg bg-muted px-5 pb-4 pt-8 text-sm">
          <NodeViewContent as="code" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}
