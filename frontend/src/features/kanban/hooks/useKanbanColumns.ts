"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Task, TaskStatus } from "@/types";
import type { KanbanColumn } from "../types";
import { DEFAULT_COLUMNS } from "../types";
import { useKanbanStore } from "../store";

export const KANBAN_COLUMNS_KEY = ["kanban", "columns"] as const;

/** Fetch all tasks (no filter) and group them into virtual columns by status. */
export function useKanbanColumns() {
  const setColumns = useKanbanStore((s) => s.setColumns);

  const query = useQuery<KanbanColumn[]>({
    queryKey: KANBAN_COLUMNS_KEY,
    queryFn: async () => {
      // GET /api/tasks → Task[] (raw array, no wrapper)
      const tasks = await api.get<Task[]>(API_ENDPOINTS.TASKS);

      // Build a map of status → Task[]
      const grouped = new Map<TaskStatus, Task[]>();
      for (const col of DEFAULT_COLUMNS) {
        grouped.set(col.id, []);
      }
      for (const task of tasks) {
        // Skip statuses not shown on the board (e.g. "archived")
        if (grouped.has(task.status)) {
          grouped.get(task.status)!.push(task);
        }
      }

      // Sort each bucket by task.position ascending
      for (const tasks of grouped.values()) {
        tasks.sort((a, b) => a.position - b.position);
      }

      return DEFAULT_COLUMNS.map((col) => ({
        ...col,
        tasks: grouped.get(col.id) ?? [],
      }));
    },
  });

  // Sync server data into the local optimistic store whenever it changes
  useEffect(() => {
    if (query.data) {
      setColumns(query.data);
    }
  }, [query.data, setColumns]);

  return query;
}
