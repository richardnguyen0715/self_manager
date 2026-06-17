"use client";

import { useState, useCallback } from "react";
import { CalendarClock, X, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TimeBlockList } from "@/types";
import { API_ENDPOINTS } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFocusStore } from "../store";

/** Format ISO datetime as "HH:MM" local time. */
function formatBlockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today's date boundaries in ISO 8601 for the timeblocks query. */
function todayBounds(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const to = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString();
  return { from, to };
}

export function TimeBlockPicker() {
  const activeBlockId = useFocusStore((s) => s.activeBlockId);

  const [open, setOpen] = useState(false);

  const { from, to } = todayBounds();
  const { data: blockList, isLoading } = useQuery({
    queryKey: ["timeblocks", "today", from],
    // GET /api/timeblocks?from=ISO&to=ISO → { data: TimeBlockList }
    queryFn: () =>
      api
        .get<{ data: TimeBlockList }>(API_ENDPOINTS.TIMEBLOCKS, {
          from,
          to,
          limit: 50,
        })
        .then((res) => res.data),
    staleTime: 1000 * 60,
  });

  const blocks = blockList?.items ?? [];
  const selectedBlock = blocks.find((b) => b.id === activeBlockId);

  const handleSelect = useCallback((blockId: string) => {
    useFocusStore.setState({ activeBlockId: blockId });
    setOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    useFocusStore.setState({ activeBlockId: null });
  }, []);

  if (selectedBlock) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-medium">{selectedBlock.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatBlockTime(selectedBlock.start_time)}–
          {formatBlockTime(selectedBlock.end_time)}
        </span>
        <button
          onClick={handleClear}
          className="ml-1 rounded-sm opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Remove selected time block"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-muted-foreground"
        disabled={isLoading}
        onClick={() => setOpen(true)}
      >
        <CalendarClock className="h-4 w-4" />
        {isLoading ? "Loading blocks..." : "Select a time block"}
        <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select a time block</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto">
            {blocks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No time blocks scheduled for today.
              </p>
            ) : (
              <div className="divide-y">
                {blocks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSelect(b.id)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium">{b.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBlockTime(b.start_time)}–
                      {formatBlockTime(b.end_time)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
