"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageSearchResult } from "@/types";

export interface PageMentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface PageMentionListProps {
  items: PageSearchResult[];
  command: (item: PageSearchResult) => void;
  loading?: boolean;
}

export const PageMentionList = forwardRef<PageMentionListHandle, PageMentionListProps>(
  ({ items, command, loading }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    useEffect(() => setSelectedIndex(0), [items]);

    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: { event: KeyboardEvent }) {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items[selectedIndex]) {
            command(items[selectedIndex]);
          }
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="z-50 w-64 overflow-hidden rounded-lg border bg-popover shadow-lg">
        <div className="max-h-60 overflow-y-auto py-1">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Searching…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No pages found
            </div>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              onClick={() => command(item)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-popover-foreground hover:bg-accent/60",
              )}
            >
              <span className="text-base leading-none shrink-0">
                {item.icon ?? <FileText className="h-4 w-4" />}
              </span>
              <span className="truncate flex-1 font-medium">
                {item.title || "Untitled"}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  },
);
PageMentionList.displayName = "PageMentionList";
