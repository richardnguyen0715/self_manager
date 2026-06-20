"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  FileText,
  Presentation,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Trash2,
  Pencil,
  ExternalLink,
  Globe,
  FilePen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useDeletePage,
  useUpdatePage,
  useSearchPages,
} from "@/features/docs";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { PageTreeNode, PageKind, PageStatus } from "@/features/docs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageListTableProps {
  spaceId: string;
  nodes: PageTreeNode[];
  onCreatePage?: () => void;
}

type SortField = "title" | "status" | "kind" | "updated_at";
type SortDir = "asc" | "desc";

interface FlatPage extends PageTreeNode {
  depth: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flatten the nested tree into a depth-annotated list, BFS order. */
function flattenTree(nodes: PageTreeNode[], depth = 0): FlatPage[] {
  const result: FlatPage[] = [];
  for (const node of nodes ?? []) {
    result.push({ ...node, depth });
    if ((node.children ?? []).length > 0) {
      result.push(...flattenTree(node.children ?? [], depth + 1));
    }
  }
  return result;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PageStatus }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <Globe className="h-3 w-3" />
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <FilePen className="h-3 w-3" />
      Draft
    </span>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: PageKind }) {
  if (kind === "whiteboard") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
        <Presentation className="h-3 w-3" />
        Whiteboard
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      <FileText className="h-3 w-3" />
      Page
    </span>
  );
}

// ─── Sort chevron ─────────────────────────────────────────────────────────────

function SortChevron({
  field,
  activeField,
  dir,
}: {
  field: SortField;
  activeField: SortField;
  dir: SortDir;
}) {
  if (field !== activeField) {
    return <ChevronsUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
  }
  return dir === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3 text-foreground" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3 text-foreground" />
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  page: FlatPage;
  spaceId: string;
}

function PageRow({ page, spaceId }: RowProps) {
  const [renaming, setRenaming] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(page.title || "Untitled");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const deletePage = useDeletePage();
  const updatePage = useUpdatePage(page.id);
  const confirm = useConfirm();

  function commitRename() {
    setRenaming(false);
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== page.title) {
      updatePage.mutate({ title: trimmed });
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !(await confirm({
        title: `Delete "${page.title || "Untitled"}" and all its children?`,
        description: "This cannot be undone.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
    deletePage.mutate({ id: page.id, spaceId });
  }

  React.useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const href = `/docs/${spaceId}/${page.id}`;
  const pageHref =
    page.status === "published"
      ? `/docs/${spaceId}/${page.id}/published`
      : href;

  return (
    <tr className="group border-b last:border-0 hover:bg-muted/30 transition-colors">
      {/* Title */}
      <td className="px-4 py-2.5">
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: `${page.depth * 16}px` }}
        >
          {page.kind === "whiteboard" ? (
            <Presentation className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}

          {renaming ? (
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="flex-1 rounded border bg-background px-1 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          ) : (
            <Link
              href={href}
              className="flex-1 truncate text-sm font-medium hover:underline"
              title={page.title || "Untitled"}
            >
              {page.title || "Untitled"}
            </Link>
          )}
        </div>
      </td>

      {/* Kind */}
      <td className="px-4 py-2.5">
        <KindBadge kind={page.kind} />
      </td>

      {/* Status */}
      <td className="px-4 py-2.5">
        <StatusBadge status={page.status} />
      </td>

      {/* Actions (visible on hover) */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setRenaming(true);
            }}
            aria-label="Rename page"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          {page.status === "published" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              asChild
              aria-label="View published"
            >
              <Link href={pageHref} target="_blank">
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleDelete}
            aria-label="Delete page"
            disabled={deletePage.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PageListTable({
  spaceId,
  nodes,
  onCreatePage,
}: PageListTableProps) {
  const [search, setSearch] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<PageKind | "all">("all");
  const [statusFilter, setStatusFilter] = React.useState<PageStatus | "all">("all");
  const [sortField, setSortField] = React.useState<SortField>("title");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  // Search using the backend when query is non-empty
  const { data: searchResults } = useSearchPages(search, spaceId);

  // Flatten tree for display when not searching
  const flatPages = React.useMemo(() => flattenTree(nodes ?? []), [nodes]);

  // When a search query is active, use backend results; otherwise flat tree
  const displayPages: FlatPage[] = React.useMemo(() => {
    if (search.trim() && searchResults) {
      // Match search result IDs back to flat pages for full field access
      const byId = new Map(flatPages.map((p) => [p.id, p]));
      return searchResults.flatMap((sr) => {
        const fp = byId.get(sr.id);
        return fp ? [fp] : [];
      });
    }
    return flatPages;
  }, [search, searchResults, flatPages]);

  // Apply client-side kind + status filters
  const filtered = React.useMemo(() => {
    return displayPages.filter((p) => {
      if (kindFilter !== "all" && p.kind !== kindFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [displayPages, kindFilter, statusFilter]);

  // Sort (client-side on flat data; search already comes ranked)
  const sorted = React.useMemo(() => {
    if (search.trim()) return filtered; // preserve search rank
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = (a.title ?? "").localeCompare(b.title ?? "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "kind":
          cmp = a.kind.localeCompare(b.kind);
          break;
        default:
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir, search]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function ThButton({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) {
    return (
      <button
        className="flex items-center text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => handleSort(field)}
      >
        {children}
        <SortChevron field={field} activeField={sortField} dir={sortDir} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search pages…"
            className="pl-9 text-sm h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Type filter */}
        <div className="flex rounded-md border bg-background p-0.5 gap-0.5">
          {(["all", "page", "whiteboard"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                kindFilter === k
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "all" ? "All types" : k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex rounded-md border bg-background p-0.5 gap-0.5">
          {(["all", "draft", "published"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All status" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Create */}
        <Button size="sm" onClick={onCreatePage} className="h-9">
          <Plus className="h-3.5 w-3.5" /> New page
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left">
                  <ThButton field="title">Title</ThButton>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <ThButton field="kind">Type</ThButton>
                </th>
                <th className="px-4 py-2.5 text-left">
                  <ThButton field="status">Status</ThButton>
                </th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((page) => (
                <PageRow key={page.id} page={page} spaceId={spaceId} />
              ))}

              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {search.trim() ? (
                      <>No pages match &ldquo;{search}&rdquo;</>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground/40" />
                        <p>No pages yet.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onCreatePage}
                        >
                          <Plus className="h-3.5 w-3.5" /> Create first page
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {sorted.length > 0 && (
          <div className="border-t bg-muted/20 px-4 py-2">
            <p className="text-xs text-muted-foreground">
              {sorted.length} {sorted.length === 1 ? "page" : "pages"}
              {kindFilter !== "all" && ` · type: ${kindFilter}`}
              {statusFilter !== "all" && ` · status: ${statusFilter}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
