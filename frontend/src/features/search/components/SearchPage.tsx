"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  AlertCircle,
  RefreshCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSearchStore } from "../store";
import { useSearchQuery } from "../hooks/useSearch";
import { SearchResultItem } from "./SearchResultItem";
import type { SearchResultKind, SearchResult } from "../types";

// ─── Kind filter chip ──────────────────────────────────────────────────────────

const KIND_LABELS: Record<SearchResultKind, string> = {
  task: "Tasks",
  project: "Projects",
  habit: "Habits",
};

// Must match the three kinds the backend supports
const ALL_KINDS: SearchResultKind[] = ["task", "project", "habit"];

interface KindChipProps {
  kind: SearchResultKind;
  active: boolean;
  count?: number;
  onToggle: (k: SearchResultKind) => void;
}

function KindChip({ kind, active, count, onToggle }: KindChipProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(kind)}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent",
      )}
    >
      {KIND_LABELS[kind]}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-white/20" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Empty / zero state ────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="rounded-full bg-muted p-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">
          {query ? `No results for "${query}"` : "Type to search"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {query
            ? "Try a different keyword or adjust the filters above."
            : "Search across tasks, projects and habits."}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    pageQuery,
    pageKinds,
    pageLimit,
    setPageQuery,
    setPageKinds,
    toggleKind,
    setPageLimit,
  } = useSearchStore();

  // Sync URL ?q= param into store on mount
  useEffect(() => {
    const qParam = searchParams.get("q") ?? "";
    if (qParam && qParam !== pageQuery) {
      setPageQuery(qParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push query to URL as user types
  const updateUrl = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) {
        params.set("q", q);
      } else {
        params.delete("q");
      }
      router.replace(`/search?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setPageQuery(v);
    updateUrl(v);
  }

  function clearQuery() {
    setPageQuery("");
    updateUrl("");
    inputRef.current?.focus();
  }

  // If all kinds are selected, send no kinds param (fetch all)
  const activeKinds =
    pageKinds.length === ALL_KINDS.length ? [] : pageKinds;

  const {
    data,
    isFetching,
    isError,
    error,
    refetch,
  } = useSearchQuery(
    {
      q: pageQuery,
      kinds: activeKinds.length > 0 ? activeKinds : undefined,
      limit: pageLimit,
    },
    { enabled: pageQuery.trim().length > 0 },
  );

  // Flatten the three per-kind arrays into a single typed list for rendering
  const taskHits: SearchResult[] = (data?.tasks ?? []).map((t) => ({
    ...t,
    kind: "task" as const,
  }));
  const projectHits: SearchResult[] = (data?.projects ?? []).map((p) => ({
    ...p,
    kind: "project" as const,
  }));
  const habitHits: SearchResult[] = (data?.habits ?? []).map((h) => ({
    ...h,
    kind: "habit" as const,
  }));

  const allResults: SearchResult[] = [...taskHits, ...projectHits, ...habitHits];
  const total = data?.total ?? 0;

  // Count per kind for chip badges
  const countByKind: Record<SearchResultKind, number> = {
    task: taskHits.length,
    project: projectHits.length,
    habit: habitHits.length,
  };

  // Client-side kind filter (so toggling chips is instant without a refetch)
  const visibleResults =
    activeKinds.length === 0
      ? allResults
      : allResults.filter((r) => activeKinds.includes(r.kind));

  const allKindsActive = pageKinds.length === ALL_KINDS.length;

  function resetKinds() {
    setPageKinds(ALL_KINDS);
  }

  return (
    <div className="flex flex-col gap-6 h-full max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Find anything across tasks, projects and habits.
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={pageQuery}
          onChange={handleQueryChange}
          placeholder="Search…"
          autoFocus
          className="pl-9 pr-9 h-11 text-base"
          aria-label="Search query"
        />
        {pageQuery && (
          <button
            onClick={clearQuery}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Kind filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter:
        </span>
        {ALL_KINDS.map((k) => (
          <KindChip
            key={k}
            kind={k}
            active={pageKinds.includes(k)}
            count={pageQuery.trim() && !isFetching ? countByKind[k] : undefined}
            onToggle={toggleKind}
          />
        ))}
        {!allKindsActive && (
          <button
            onClick={resetKinds}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>

      <Separator />

      {/* Result count */}
      {pageQuery.trim() && !isFetching && !isError && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {visibleResults.length === 0
              ? "No results"
              : `${visibleResults.length}${total > visibleResults.length ? ` of ${total}` : ""} result${visibleResults.length !== 1 ? "s" : ""}`}
          </span>
          {total > pageLimit && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0"
              onClick={() => setPageLimit(Math.min(pageLimit + 20, 50))}
            >
              Load more
            </Button>
          )}
        </div>
      )}

      {/* States */}
      {isFetching && (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Searching…</span>
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-semibold">Search failed</p>
            <p className="text-sm text-muted-foreground mt-1">
              {(error as Error)?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {!isFetching && !isError && (
        <>
          {visibleResults.length === 0 ? (
            <EmptyState query={pageQuery.trim()} />
          ) : (
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div
                role="listbox"
                aria-label="Search results"
                className="flex flex-col gap-0.5 pb-10"
              >
                {/* Group results by kind */}
                {ALL_KINDS.filter(
                  (k) => activeKinds.length === 0 || activeKinds.includes(k),
                ).map((kind) => {
                  const items = visibleResults.filter((r) => r.kind === kind);
                  if (items.length === 0) return null;
                  return (
                    <div key={kind} className="mb-4">
                      <div className="mb-1 flex items-center gap-2 px-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {KIND_LABELS[kind]}
                        </span>
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 py-0 text-[10px]"
                        >
                          {items.length}
                        </Badge>
                      </div>
                      <div className="rounded-lg border bg-card overflow-hidden">
                        {items.map((r, idx) => (
                          <div key={r.id}>
                            <SearchResultItem result={r} />
                            {idx < items.length - 1 && (
                              <Separator className="mx-3" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  );
}
