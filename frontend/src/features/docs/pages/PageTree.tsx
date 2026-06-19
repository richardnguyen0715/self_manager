"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  Presentation,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useDeletePage,
  useUpdatePage,
} from "@/features/docs";
import type { PageTreeNode } from "@/features/docs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageTreeProps {
  spaceId: string;
  nodes: PageTreeNode[];
  activePageId?: string;
  onCreatePage?: (parentId?: string) => void;
}

// ─── Context menu (inline, positioned relative) ───────────────────────────────

interface ContextMenuState {
  nodeId: string;
  spaceId: string;
  title: string;
}

// ─── Rename input ─────────────────────────────────────────────────────────────

interface RenameInputProps {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

function RenameInput({ initialValue, onSave, onCancel }: RenameInputProps) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave(value.trim() || initialValue);
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(value.trim() || initialValue)}
      className="h-6 px-1 py-0 text-xs"
      autoFocus
    />
  );
}

// ─── Context menu popover ─────────────────────────────────────────────────────

interface NodeMenuProps {
  onRename: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onClose: () => void;
}

function NodeMenu({ onRename, onDelete, onAddChild, onClose }: NodeMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-0.5 w-44 rounded-md border bg-popover py-1 shadow-lg"
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent"
        onClick={() => {
          onAddChild();
          onClose();
        }}
      >
        <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
        Add child page
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent"
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        Rename
      </button>
      <div className="my-1 h-px bg-border" />
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  );
}

// ─── Single tree node ─────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: PageTreeNode;
  spaceId: string;
  depth: number;
  activePageId?: string;
  onCreatePage: (parentId?: string) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}

function TreeNode({
  node,
  spaceId,
  depth,
  activePageId,
  onCreatePage,
  expandedIds,
  onToggleExpand,
}: TreeNodeProps) {
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isActive = node.id === activePageId;

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);

  const deletePage = useDeletePage();
  const updatePage = useUpdatePage(node.id);

  function handleDelete() {
    deletePage.mutate({ id: node.id, spaceId });
  }

  function handleRename(newTitle: string) {
    setRenaming(false);
    if (newTitle !== node.title) {
      updatePage.mutate({ title: newTitle });
    }
  }

  const indentPx = depth * 12 + 8;

  const PageIcon =
    node.kind === "whiteboard" ? Presentation : FileText;

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-0.5 rounded-md py-0.5 pr-1 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
        )}
        style={{ paddingLeft: `${indentPx}px` }}
      >
        {/* Expand/Collapse chevron */}
        <button
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onClick={() => hasChildren && onToggleExpand(node.id)}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>

        {/* Page icon */}
        <PageIcon className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />

        {/* Title / rename */}
        {renaming ? (
          <RenameInput
            initialValue={node.title || "Untitled"}
            onSave={handleRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <Link
            href={`/docs/${spaceId}/${node.id}`}
            className="min-w-0 flex-1 truncate"
          >
            {node.title || "Untitled"}
          </Link>
        )}

        {/* Hover actions */}
        {!renaming && (
          <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={(e) => {
                e.stopPropagation();
                onCreatePage(node.id);
              }}
              aria-label="Add child page"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                aria-label="More actions"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>

              {menuOpen && (
                <NodeMenu
                  onRename={() => setRenaming(true)}
                  onDelete={handleDelete}
                  onAddChild={() => onCreatePage(node.id)}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              spaceId={spaceId}
              depth={depth + 1}
              activePageId={activePageId}
              onCreatePage={onCreatePage}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PageTree root ────────────────────────────────────────────────────────────

export function PageTree({
  spaceId,
  nodes,
  activePageId,
  onCreatePage,
}: PageTreeProps) {
  const safeNodes = nodes ?? [];

  // Auto-expand the path to the active page on mount
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => {
    if (!activePageId) return new Set<string>();
    // Collect all ancestor IDs so the active page is visible
    const ancestors = new Set<string>();
    function findAncestors(items: PageTreeNode[], targetId: string): boolean {
      for (const item of items) {
        if (item.id === targetId) return true;
        if ((item.children ?? []).length > 0) {
          if (findAncestors(item.children ?? [], targetId)) {
            ancestors.add(item.id);
            return true;
          }
        }
      }
      return false;
    }
    findAncestors(safeNodes, activePageId);
    return ancestors;
  });

  function handleToggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleCreatePage(parentId?: string) {
    onCreatePage?.(parentId);
    // Auto-expand parent when adding a child
    if (parentId) {
      setExpandedIds((prev) => new Set([...prev, parentId]));
    }
  }

  if (safeNodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No pages yet</p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => handleCreatePage()}
        >
          <Plus className="h-3 w-3" /> New page
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <nav className="flex flex-col gap-0 px-2 pb-3">
        {safeNodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            spaceId={spaceId}
            depth={0}
            activePageId={activePageId}
            onCreatePage={handleCreatePage}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </nav>
    </ScrollArea>
  );
}
