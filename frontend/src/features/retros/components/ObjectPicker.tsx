"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useWorkItems } from "@/features/workitems/hooks/useWorkItems";
import { useSprints } from "@/features/agile/hooks/useSprints";
import { useProjects } from "@/features/tasks/hooks/useProjects";
import { useEpics } from "@/features/agile/hooks/useEpics";
import { useInitiatives } from "@/features/agile/hooks/useInitiatives";
import { useGoals } from "@/features/goals/hooks/useGoals";
import { useHabits } from "@/features/habits/hooks/useHabits";
import { useDocsSearch } from "@/features/docs/hooks/useDocs";
import type { RetroLinkTargetType } from "../types";
import { RETRO_LINK_TYPE_LABELS } from "../types";

// ─── Public types ────────────────────────────────────────────────────────────

export interface PickedObject {
  targetType: RetroLinkTargetType;
  targetId: string;
  title: string;
}

interface ObjectPickerProps {
  /** Type tabs to show, in order. A single type renders no tab row. */
  types: RetroLinkTargetType[];
  onPick: (picked: PickedObject) => void;
  /** Hide the search box when only a fixed list is wanted. */
  autoFocus?: boolean;
  className?: string;
}

interface SourceProps {
  q: string;
  onPick: (picked: PickedObject) => void;
}

interface OptionItem {
  id: string;
  title: string;
  subtitle?: string | null;
}

const MAX_OPTIONS = 20;

function matches(q: string, ...fields: (string | null | undefined)[]) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

// ─── Option list ──────────────────────────────────────────────────────────────

function OptionList({
  items,
  isLoading,
  emptyText,
  targetType,
  onPick,
}: {
  items: OptionItem[];
  isLoading: boolean;
  emptyText: string;
  targetType: RetroLinkTargetType;
  onPick: (picked: PickedObject) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>
    );
  }
  return (
    <ul className="max-h-64 overflow-y-auto">
      {items.slice(0, MAX_OPTIONS).map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() =>
              onPick({ targetType, targetId: item.id, title: item.title })
            }
            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <span className="truncate">{item.title}</span>
            {item.subtitle ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.subtitle}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Per-type sources (each calls its existing list hook) ─────────────────────

function WorkItemSource({ q, onPick }: SourceProps) {
  const { data, isLoading } = useWorkItems({
    search: q.trim() || undefined,
    limit: MAX_OPTIONS,
  });
  const items: OptionItem[] = (data?.data ?? []).map((w) => ({
    id: w.id,
    title: w.title,
    subtitle: w.key ?? w.status,
  }));
  return (
    <OptionList
      items={items}
      isLoading={isLoading}
      emptyText="No work items found."
      targetType="work_item"
      onPick={onPick}
    />
  );
}

function SprintSource({ q, onPick }: SourceProps) {
  const { data, isLoading } = useSprints({ limit: 100 });
  const items: OptionItem[] = (data?.data ?? [])
    .filter((s) => matches(q, s.name))
    .map((s) => ({ id: s.id, title: s.name, subtitle: s.status }));
  return (
    <OptionList
      items={items}
      isLoading={isLoading}
      emptyText="No sprints found."
      targetType="sprint"
      onPick={onPick}
    />
  );
}

function ProjectSource({ q, onPick }: SourceProps) {
  const { data, isLoading } = useProjects();
  const items: OptionItem[] = (data ?? [])
    .filter((p) => matches(q, p.name, p.key))
    .map((p) => ({ id: p.id, title: p.name, subtitle: p.key ?? null }));
  return (
    <OptionList
      items={items}
      isLoading={isLoading}
      emptyText="No projects found."
      targetType="project"
      onPick={onPick}
    />
  );
}

function EpicSource({ q, onPick }: SourceProps) {
  const { data, isLoading } = useEpics({ limit: 100 });
  const items: OptionItem[] = (data?.data ?? [])
    .filter((e) => matches(q, e.title))
    .map((e) => ({ id: e.id, title: e.title, subtitle: e.status }));
  return (
    <OptionList
      items={items}
      isLoading={isLoading}
      emptyText="No epics found."
      targetType="epic"
      onPick={onPick}
    />
  );
}

function InitiativeSource({ q, onPick }: SourceProps) {
  const { data, isLoading } = useInitiatives({ limit: 100 });
  const items: OptionItem[] = (data?.data ?? [])
    .filter((i) => matches(q, i.title))
    .map((i) => ({ id: i.id, title: i.title, subtitle: i.status }));
  return (
    <OptionList
      items={items}
      isLoading={isLoading}
      emptyText="No initiatives found."
      targetType="initiative"
      onPick={onPick}
    />
  );
}

function GoalSource({ q, onPick }: SourceProps) {
  const { data, isLoading } = useGoals({ limit: 100 });
  const items: OptionItem[] = (data?.data ?? [])
    .filter((g) => matches(q, g.title))
    .map((g) => ({ id: g.id, title: g.title, subtitle: g.status }));
  return (
    <OptionList
      items={items}
      isLoading={isLoading}
      emptyText="No goals found."
      targetType="goal"
      onPick={onPick}
    />
  );
}

function HabitSource({ q, onPick }: SourceProps) {
  const { data, isLoading } = useHabits({});
  const items: OptionItem[] = (data ?? [])
    .filter((h) => !h.archived && matches(q, h.name))
    .map((h) => ({ id: h.id, title: h.name, subtitle: h.habit_type }));
  return (
    <OptionList
      items={items}
      isLoading={isLoading}
      emptyText="No habits found."
      targetType="habit"
      onPick={onPick}
    />
  );
}

function DocSource({ q, onPick }: SourceProps) {
  const { data, isFetching } = useDocsSearch(q.trim());
  if (!q.trim()) {
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        Type to search docs.
      </p>
    );
  }
  const items: OptionItem[] = (data?.pages ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    subtitle: null,
  }));
  return (
    <OptionList
      items={items}
      isLoading={isFetching && !data}
      emptyText="No docs found."
      targetType="doc"
      onPick={onPick}
    />
  );
}

/** Retros are linked from the retro page itself, not picked here. */
function RetroSource() {
  return (
    <p className="px-2 py-3 text-sm text-muted-foreground">
      Retros cannot be linked from this picker.
    </p>
  );
}

const SOURCES: Record<
  RetroLinkTargetType,
  (props: SourceProps) => React.ReactNode
> = {
  work_item: (p) => <WorkItemSource {...p} />,
  sprint: (p) => <SprintSource {...p} />,
  project: (p) => <ProjectSource {...p} />,
  epic: (p) => <EpicSource {...p} />,
  initiative: (p) => <InitiativeSource {...p} />,
  goal: (p) => <GoalSource {...p} />,
  habit: (p) => <HabitSource {...p} />,
  doc: (p) => <DocSource {...p} />,
  retro: () => <RetroSource />,
};

// ─── Picker ───────────────────────────────────────────────────────────────────

/**
 * Type tabs + search + option list. Only the active type's source is mounted,
 * so only that type's list hook runs.
 */
export function ObjectPicker({
  types,
  onPick,
  autoFocus = true,
  className,
}: ObjectPickerProps) {
  const [type, setType] = useState<RetroLinkTargetType>(types[0]);
  const [q, setQ] = useState("");
  const Source = SOURCES[type];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {types.length > 1 ? (
        <div className="flex flex-wrap gap-1" role="tablist">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === type}
              onClick={() => setType(t)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                t === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {RETRO_LINK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${RETRO_LINK_TYPE_LABELS[type].toLowerCase()}…`}
          autoFocus={autoFocus}
          className="pl-8"
          aria-label="Search objects"
        />
      </div>

      {Source({ q, onPick })}
    </div>
  );
}
