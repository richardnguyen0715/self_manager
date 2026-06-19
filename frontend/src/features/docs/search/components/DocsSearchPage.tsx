"use client";

import { useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  AlertCircle,
  RefreshCcw,
  FileText,
  Database,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useDocsSearchDebounced } from "../hooks/useDocsSearchDebounced";
import { DocsSearchResultItem } from "./DocsSearchResultItem";
import type { PageSearchHit, DatabaseSearchHit } from "@/types";
import type { DocsPageHit, DocsDatabaseHit } from "./DocsSearchResultItem";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DocKind = "page" | "database";

const ALL_DOC_KINDS: DocKind[] = ["page", "database"];

const DOC_KIND_LABELS: Record<DocKind, string> = {
  page: "Pages",
  database: "Databases",
};

// ─── Kind filter chip ──────────────────────────────────────────────────────────

interface KindChipProps {
  kind: DocKind;
  active: boolean;
  count?: number;
  onToggle: (k: DocKind) => void;
}

function KindChip({ kind, active, count, onToggle }: KindChipProps) {
  const Icon = kind === "page" ? FileText : Database;
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
      <Icon className="h-3 w-3" />
      {DOC_KIND_LABELS[kind]}
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

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="rounded-full bg-muted p-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">
          {query ? `No docs results for “${query}”` : "Search pages and databases"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {query
            ? "Try a different keyword or clear the filter."
            : "Search across all your pages and databases."}
        </p>
      </div>
    </div>
  );
}

// ─── Grouped results section ───────────────────────────────────────────────────

interface ResultGroupProps {
  label: string;
  icon: React.ElementType;
  items: Array<DocsPageHit | DocsDatabaseHit>;
}

function ResultGroup({ label, icon: Icon, items }: ResultGroupProps) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-2 px-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px]">
          {items.length}
        </Badge>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        {items.map((item, idx) => (
          <div key={item.id}>
            <DocsSearchResultItem hit={item} />
            {idx < items.length - 1 && <Separator className="mx-3" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

/**
 * Standalone `/docs/search` page component.
 *
 * - Reads initial `?q=` from the URL on mount.
 * - Debounced query via `useDocsSearchDebounced` (~250 ms).
 * - Pages + Databases shown in grouped sections with client-side kind chips.
 */
export function DocsSearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Live query — bound to the input
  const [liveQuery, setLiveQuery] = useState<string>(
    () => searchParams.get("q") ?? "",
  );

  // Client-side kind filter
  const [activeKinds, setActiveKinds] = useState<DocKind[]>(ALL_DOC_KINDS);

  // Keep URL in sync
  const updateUrl = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      router.replace(`/docs/search?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setLiveQuery(v);
    updateUrl(v);
  }

  function clearQuery() {
    setLiveQuery("");
    updateUrl("");
    inputRef.current?.focus();
  }

  function toggleKind(k: DocKind) {
    setActiveKinds((prev) => {
      const has = prev.includes(k);
      const next = has ? prev.filter((x) => x !== k) : [...prev, k];
      return next.length === 0 ? ALL_DOC_KINDS : next;
    });
  }

  // Debounced search
  const { data, isFetching, isError, error, refetch } =
    useDocsSearchDebounced(liveQuery);

  // Enrich hits with kind discriminant
  const pageHits: DocsPageHit[] = (data.pages ?? []).map(
    (p: PageSearchHit) => ({ ...p, kind: "page" as const }),
  );
  const databaseHits: DocsDatabaseHit[] = (data.databases ?? []).map(
    (d: DatabaseSearchHit) => ({ ...d, kind: "database" as const }),
  );

  // Apply client-side kind filter
  const visiblePages = activeKinds.includes("page") ? pageHits : [];
  const visibleDatabases = activeKinds.includes("database") ? databaseHits : [];
  const totalVisible = visiblePages.length + visibleDatabases.length;
  const hasResults = totalVisible > 0;
  const trimmedQuery = liveQuery.trim();
  const allKindsActive = activeKinds.length === ALL_DOC_KINDS.length;

  return (
    <div className="flex flex-col gap-6 h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Docs Search</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Search across all your pages and databases.
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={liveQuery}
          onChange={handleQueryChange}
          placeholder="Search pages and databases…"
          autoFocus
          className="pl-9 pr-9 h-11 text-base"
          aria-label="Docs search query"
        />
        {liveQuery && (
          <button
            onClick={clearQuery}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
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
        {ALL_DOC_KINDS.map((k) => (
          <KindChip
            key={k}
            kind={k}
            active={activeKinds.includes(k)}
            count={
              trimmedQuery && !isFetching
                ? k === "page"
                  ? pageHits.length
                  : databaseHits.length
                : undefined
            }
            onToggle={toggleKind}
          />
        ))}
        {!allKindsActive && (
          <button
            onClick={() => setActiveKinds(ALL_DOC_KINDS)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>

      <Separator />

      {/* Result count */}
      {trimmedQuery && !isFetching && !isError && hasResults && (
        <div className="text-sm text-muted-foreground">
          {totalVisible} result{totalVisible !== 1 ? "s" : ""}
        </div>
      )}

      {/* Loading */}
      {isFetching && (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Searching…</span>
        </div>
      )}

      {/* Error */}
      {isError && !isFetching && (
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

      {/* Results */}
      {!isFetching && !isError && (
        <>
          {!hasResults ? (
            <EmptyState query={trimmedQuery} />
          ) : (
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div
                role="listbox"
                aria-label="Docs search results"
                className="flex flex-col gap-0.5 pb-10"
              >
                <ResultGroup
                  label="Pages"
                  icon={FileText}
                  items={visiblePages}
                />
                <ResultGroup
                  label="Databases"
                  icon={Database}
                  items={visibleDatabases}
                />
              </div>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  );
}
