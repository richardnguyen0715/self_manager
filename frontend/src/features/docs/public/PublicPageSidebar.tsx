"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FileText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicPageRef, PublicPageTreeNode } from "@/types";
import { usePublicPageTree } from "@/features/docs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicPageSidebarProps {
  /** Root slug — used to load the full subtree for nav. */
  rootSlug: string;
  /** Active slug (current page). */
  activeSlug: string;
  /**
   * Flat direct children from the page response (fast path — no extra fetch
   * needed when the tree request is still loading).
   */
  directChildren: PublicPageRef[];
}

// ─── Tree node renderer ───────────────────────────────────────────────────────

function TreeNodeItem({
  node,
  activeSlug,
  depth,
}: {
  node: PublicPageTreeNode;
  activeSlug: string;
  depth: number;
}) {
  const slug = node.public_slug;
  const isActive = slug === activeSlug;
  const hasChildren = (node.children ?? []).length > 0;

  return (
    <li>
      <Link
        href={slug ? `/p/${slug}` : "#"}
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive
            ? "bg-accent/60 font-medium text-foreground"
            : "text-muted-foreground",
          // Indent by depth
          depth > 0 && "ml-4",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {/* Icon: emoji or default file icon */}
        {node.icon ? (
          <span className="shrink-0 text-base leading-none" aria-hidden>
            {node.icon}
          </span>
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
        )}
        <span className="truncate">{node.title || "Untitled"}</span>
        {hasChildren && (
          <ChevronRight className="ml-auto h-3 w-3 shrink-0 opacity-40" aria-hidden />
        )}
      </Link>

      {hasChildren && (
        <ul className="mt-0.5 space-y-0.5">
          {(node.children ?? []).map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              activeSlug={activeSlug}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function PublicPageSidebar({
  rootSlug,
  activeSlug,
  directChildren,
}: PublicPageSidebarProps) {
  // Try to load the full subtree for richer nav; fall back to direct children
  // from the page response if the tree hasn't loaded yet.
  const { data: treeNodes } = usePublicPageTree(rootSlug);

  // If the tree is available, render it; otherwise show the flat direct children
  const hasTree = treeNodes && treeNodes.length > 0;

  return (
    <nav
      aria-label="Page navigation"
      className="w-56 shrink-0 py-6 pr-4"
    >
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
        On this site
      </p>

      {hasTree ? (
        <ul className="space-y-0.5">
          {treeNodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              activeSlug={activeSlug}
              depth={0}
            />
          ))}
        </ul>
      ) : directChildren.length > 0 ? (
        <ul className="space-y-0.5">
          {directChildren.map((child) => (
            <li key={child.id}>
              <Link
                href={child.public_slug ? `/p/${child.public_slug}` : "#"}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors",
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  child.public_slug === activeSlug && "bg-accent/60 font-medium text-foreground",
                )}
              >
                {child.icon ? (
                  <span className="shrink-0 text-base leading-none" aria-hidden>
                    {child.icon}
                  </span>
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                )}
                <span className="truncate">{child.title || "Untitled"}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
