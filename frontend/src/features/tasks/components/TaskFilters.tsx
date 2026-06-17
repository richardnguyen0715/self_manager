"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority, TaskStatus } from "@/types";
import { useProjects } from "../hooks/useProjects";
import { useTags } from "../hooks/useTags";
import { useTaskUIStore } from "../store";
import type { TaskFiltersState } from "../types";

// ─── Generic select ───────────────────────────────────────────────────────────

interface FilterSelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  placeholder: string;
  options: { value: T; label: string }[];
  className?: string;
}

function FilterSelect<T extends string>({
  value,
  onChange,
  placeholder,
  options,
  className,
}: FilterSelectProps<T>) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-8 items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "gap-2 whitespace-nowrap",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:translate-y-1",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "focus:bg-accent focus:text-accent-foreground",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskFiltersState["status"]; label: string }[] =
  [
    { value: "all", label: "All statuses" },
    { value: "inbox", label: "Inbox" },
    { value: "planned", label: "Planned" },
    { value: "in_progress", label: "In Progress" },
    { value: "waiting", label: "Waiting" },
    { value: "completed", label: "Completed" },
    { value: "archived", label: "Archived" },
  ];

const PRIORITY_OPTIONS: {
  value: TaskFiltersState["priority"];
  label: string;
}[] = [
  { value: "all", label: "All priorities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const DUE_OPTIONS: { value: TaskFiltersState["due_filter"]; label: string }[] =
  [
    { value: "all", label: "Any due date" },
    { value: "today", label: "Due today" },
    { value: "overdue", label: "Overdue" },
    { value: "upcoming", label: "Upcoming" },
    { value: "no_date", label: "No date" },
  ];

const SORT_OPTIONS: { value: TaskFiltersState["sort_by"]; label: string }[] = [
  { value: "created_at", label: "Date created" },
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskFilters() {
  const { filters, setFilter, resetFilters } = useTaskUIStore();
  const { data: projectsData } = useProjects();
  const { data: tagsData } = useTags();

  const projects = projectsData ?? [];
  const tags = tagsData ?? [];

  const projectOptions: { value: string; label: string }[] = [
    { value: "all", label: "All projects" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const tagOptions: { value: string; label: string }[] = [
    { value: "all", label: "All tags" },
    ...tags.map((t) => ({ value: t.id, label: t.name })),
  ];

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.project_id !== "all" ||
    filters.tag_id !== "all" ||
    filters.due_filter !== "all" ||
    filters.search !== "";

  const activeFilterCount = [
    filters.status !== "all",
    filters.priority !== "all",
    filters.project_id !== "all",
    filters.tag_id !== "all",
    filters.due_filter !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search + reset row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="pl-8 h-9"
          />
          {filters.search && (
            <button
              onClick={() => setFilter("search", "")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-9 gap-1.5 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}

        <div className="flex items-center gap-1 text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
        </div>
      </div>

      {/* Filter chips row */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={filters.status}
          onChange={(v) => setFilter("status", v as TaskStatus | "all")}
          placeholder="Status"
          options={STATUS_OPTIONS}
          className="w-36"
        />

        <FilterSelect
          value={filters.priority}
          onChange={(v) => setFilter("priority", v as Priority | "all")}
          placeholder="Priority"
          options={PRIORITY_OPTIONS}
          className="w-36"
        />

        <FilterSelect
          value={filters.due_filter}
          onChange={(v) =>
            setFilter("due_filter", v as TaskFiltersState["due_filter"])
          }
          placeholder="Due date"
          options={DUE_OPTIONS}
          className="w-36"
        />

        {projects.length > 0 && (
          <FilterSelect
            value={filters.project_id}
            onChange={(v) => setFilter("project_id", v)}
            placeholder="Project"
            options={projectOptions}
            className="w-40"
          />
        )}

        {tags.length > 0 && (
          <FilterSelect
            value={filters.tag_id}
            onChange={(v) => setFilter("tag_id", v)}
            placeholder="Tag"
            options={tagOptions}
            className="w-36"
          />
        )}

        {/* Sort */}
        <div className="ml-auto flex items-center gap-1">
          <FilterSelect
            value={filters.sort_by}
            onChange={(v) =>
              setFilter("sort_by", v as TaskFiltersState["sort_by"])
            }
            placeholder="Sort by"
            options={SORT_OPTIONS}
            className="w-36"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() =>
              setFilter("sort_dir", filters.sort_dir === "asc" ? "desc" : "asc")
            }
            aria-label={`Sort ${filters.sort_dir === "asc" ? "descending" : "ascending"}`}
            title={`Sort ${filters.sort_dir === "asc" ? "descending" : "ascending"}`}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                filters.sort_dir === "asc" && "rotate-180",
              )}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
