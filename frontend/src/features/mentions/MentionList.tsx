"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { useMentionSearch } from "./hooks";
import {
  MENTION_FILTERS,
  MENTION_TYPES,
  MENTION_TYPE_META,
} from "./types";
import type { MentionSearchResult } from "./types";

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  /** Text typed after the "@" trigger. */
  query: string;
  command: (item: MentionSearchResult) => void;
}

const SEARCH_DEBOUNCE_MS = 150;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function sortByTypeOrder(items: MentionSearchResult[]): MentionSearchResult[] {
  const rank = new Map(MENTION_TYPES.map((t, i) => [t, i]));
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (rank.get(a.item.type) ?? 99) - (rank.get(b.item.type) ?? 99) ||
        a.index - b.index,
    )
    .map((x) => x.item);
}

/**
 * Popup list for the @ picker. Owns its own search (react-query, 150 ms
 * debounce) so the suggestion plugin only needs the query text.
 *
 * Keys: ArrowUp/ArrowDown move, Enter selects, ArrowLeft/ArrowRight (or
 * Shift+Tab / Tab) cycle the type filter pills. Escape is handled by the suggestion wrapper.
 */
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList({ query, command }, ref) {
    const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
    const [filterIndex, setFilterIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const filter = MENTION_FILTERS[filterIndex];
    const { data, isFetching, isError } = useMentionSearch(
      debouncedQuery,
      filter.types,
    );
    const items = useMemo(() => sortByTypeOrder(data ?? []), [data]);
    const showGroupHeaders = filter.key === "all";

    useEffect(() => setSelectedIndex(0), [items, filterIndex]);

    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }) {
        if (event.key === "ArrowDown") {
          if (items.length === 0) return true;
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          if (items.length === 0) return true;
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selectedIndex];
          if (!item) return false;
          command(item);
          return true;
        }
        if (event.key === "Tab" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
          const step =
            event.key === "ArrowLeft" || (event.key === "Tab" && event.shiftKey) ? -1 : 1;
          setFilterIndex((i) => (i + step + MENTION_FILTERS.length) % MENTION_FILTERS.length);
          return true;
        }
        return false;
      },
    }));

    const emptyMessage = isError
      ? "Search failed"
      : debouncedQuery.trim()
        ? isFetching
          ? "Searching..."
          : "No matches"
        : isFetching
          ? "Loading..."
          : "Nothing recent";

    let lastType: string | null = null;

    return (
      <div
        className="w-80 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        role="listbox"
        aria-label="Mention an object"
      >
        <div className="flex gap-1 overflow-x-auto border-b p-1" role="tablist">
          {MENTION_FILTERS.map((f, i) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={i === filterIndex}
              ref={(el) => {
                if (el && i === filterIndex) el.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setFilterIndex(i)}
              className={cn(
                "shrink-0 rounded px-2 py-0.5 text-xs transition-colors",
                i === filterIndex
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            items.map((item, index) => {
              const meta = MENTION_TYPE_META[item.type];
              const Icon = meta.icon;
              const header =
                showGroupHeaders && item.type !== lastType ? meta.label + "s" : null;
              lastType = item.type;
              return (
                <div key={`${item.type}:${item.id}`}>
                  {header && (
                    <div className="px-2 pb-0.5 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {header}
                    </div>
                  )}
                  <button
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => command(item)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                      index === selectedIndex ? "bg-muted" : "hover:bg-muted/60",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", meta.className)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.title || "Untitled"}</span>
                      {item.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    {!showGroupHeaders && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{meta.label}</span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  },
);
