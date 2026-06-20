"use client";

import { useState } from "react";
import {
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  X,
  Search,
  ListTodo,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { WorkItemListItem, WorkItemStatus, AgileListResponse } from "@/types";
import {
  useSprintDetail,
  useSprintWorkItemsList,
  useMoveItemToSprint,
  useMoveItemToBacklog,
} from "../hooks/useSprints";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CapacityBar } from "./CapacityBar";
import { BacklogItemRow, SprintItemRow } from "./WorkItemPlanRow";

// ─── Main panel ───────────────────────────────────────────────────────────────

interface SprintPlanningPanelProps {
  sprintId: string;
}

export function SprintPlanningPanel({ sprintId }: SprintPlanningPanelProps) {
  const [backlogSearch, setBacklogSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkItemStatus | "all">("all");
  const [movingItemId, setMovingItemId] = useState<string | null>(null);

  const { data: sprint, isLoading: sprintLoading } = useSprintDetail(sprintId);
  const { data: sprintItemsData, isLoading: itemsLoading } =
    useSprintWorkItemsList(sprintId);

  // GET /api/backlog?status? — Response: { data: WorkItemListItem[], total }
  const backlogParams: Record<string, string | undefined> = {};
  if (statusFilter !== "all") backlogParams.status = statusFilter;

  const { data: backlogData, isLoading: backlogLoading } = useQuery({
    queryKey: ["backlog", { statusFilter }],
    queryFn: () =>
      api.get<AgileListResponse<WorkItemListItem>>(
        API_ENDPOINTS.BACKLOG,
        backlogParams as Record<string, string | number | boolean | undefined | null>,
      ),
    placeholderData: keepPreviousData,
  });

  const moveToSprint = useMoveItemToSprint();
  const moveToBacklog = useMoveItemToBacklog();
  const confirm = useConfirm();

  const currentSprintItems = sprintItemsData?.data ?? [];

  // Client-side search filter on the already-fetched backlog
  const allBacklogItems = backlogData?.data ?? [];
  const backlogItems = backlogSearch.trim()
    ? allBacklogItems.filter((item) =>
        item.title.toLowerCase().includes(backlogSearch.toLowerCase()),
      )
    : allBacklogItems;

  const sprintPlannedPts = sprint?.planned_points ?? 0;
  const sprintCapacityPts = sprint?.capacity_points ?? 0;

  async function handleMoveToSprint(itemId: string) {
    if (!sprint) return;
    // Optimistic capacity check — backend enforces hard 409.
    const item = allBacklogItems.find((i) => i.id === itemId);
    const itemPts = item?.story_points ?? 0;
    if (
      sprintCapacityPts > 0 &&
      sprintPlannedPts + itemPts > sprintCapacityPts
    ) {
      const confirmed = await confirm({
        title: "Exceed sprint capacity?",
        description: `Adding this item (${itemPts} pts) would exceed sprint capacity (${sprintPlannedPts}/${sprintCapacityPts} pts). Continue?`,
        confirmText: "Continue",
        destructive: false,
      });
      if (!confirmed) return;
    }
    setMovingItemId(itemId);
    try {
      await moveToSprint.mutateAsync({ itemId, sprintId });
    } finally {
      setMovingItemId(null);
    }
  }

  async function handleMoveToBacklog(itemId: string) {
    setMovingItemId(itemId);
    try {
      await moveToBacklog.mutateAsync({ itemId, sprintId });
    } finally {
      setMovingItemId(null);
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 md:h-[560px]">
      {/* ── Left: Backlog ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 rounded-lg border bg-card overflow-hidden h-[360px] md:h-auto">
        <div className="px-4 py-3 border-b space-y-2 shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            Backlog
            {backlogData?.total != null && (
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({backlogData.total})
              </span>
            )}
          </h3>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={backlogSearch}
                onChange={(e) => setBacklogSearch(e.target.value)}
                placeholder="Filter backlog…"
                className="h-8 w-full pl-8 pr-8 rounded-md border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {backlogSearch && (
                <button
                  type="button"
                  onClick={() => setBacklogSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as WorkItemStatus | "all")
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">In Review</option>
            </select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {backlogLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : backlogItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
              <AlertCircle className="h-6 w-6 mb-2 opacity-40" />
              {backlogSearch ? "No items match your search" : "Backlog is empty"}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {backlogItems.map((item) => (
                <BacklogItemRow
                  key={item.id}
                  item={item}
                  sprintId={sprintId}
                  isMoving={movingItemId === item.id && moveToSprint.isPending}
                  onMove={handleMoveToSprint}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: Sprint items ───────────────────────────────────────── */}
      <div className="flex flex-col w-full md:w-[340px] shrink-0 rounded-lg border bg-card overflow-hidden h-[320px] md:h-auto">
        <div className="px-4 py-3 border-b space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight truncate">
              {sprintLoading ? "Sprint" : (sprint?.name ?? "Sprint")}
            </h3>
            {!itemsLoading && (
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {currentSprintItems.length} items
              </span>
            )}
          </div>

          {sprint && (
            <CapacityBar
              planned={sprintPlannedPts}
              capacity={sprintCapacityPts}
            />
          )}
        </div>

        <ScrollArea className="flex-1">
          {itemsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : currentSprintItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm text-center px-4">
              <p>No items in this sprint yet.</p>
              <p className="text-xs mt-1 opacity-70">Pick items from the backlog.</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {currentSprintItems.map((item) => (
                <SprintItemRow
                  key={item.id}
                  item={item}
                  sprintId={sprintId}
                  isMoving={movingItemId === item.id && moveToBacklog.isPending}
                  onRemove={handleMoveToBacklog}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
