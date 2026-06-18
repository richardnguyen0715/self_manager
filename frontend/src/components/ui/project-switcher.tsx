"use client";

import { useState } from "react";
import { Check, ChevronDown, FolderOpen, Loader2 } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores";
import { useProjects } from "@/features/tasks/hooks/useProjects";

interface ProjectSwitcherProps {
  /** When the sidebar is collapsed we only show the icon. */
  collapsed?: boolean;
}

export function ProjectSwitcher({ collapsed = false }: ProjectSwitcherProps) {
  const { currentProjectId, setCurrentProject } = useProjectStore();
  const { data: projects, isLoading } = useProjects();

  const projectList = projects ?? [];
  const selectedName =
    currentProjectId == null
      ? "All projects"
      : (projectList.find((p) => p.id === currentProjectId)?.name ?? "All projects");

  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <SelectPrimitive.Root
      value={currentProjectId ?? "__all__"}
      onValueChange={(v) => setCurrentProject(v === "__all__" ? null : v)}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <span className="truncate text-xs font-medium">{selectedName}</span>
          )}
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-50 w-[--radix-select-trigger-width] min-w-[10rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:translate-y-1",
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {/* All projects sentinel */}
            <SelectPrimitive.Item
              value="__all__"
              className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                "focus:bg-accent focus:text-accent-foreground",
              )}
            >
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <SelectPrimitive.ItemIndicator>
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </span>
              <SelectPrimitive.ItemText>All projects</SelectPrimitive.ItemText>
            </SelectPrimitive.Item>

            {/* Project options */}
            {projectList.map((project) => (
              <SelectPrimitive.Item
                key={project.id}
                value={project.id}
                className={cn(
                  "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "focus:bg-accent focus:text-accent-foreground",
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>
                  {project.name}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}

            {/* Empty state */}
            {!isLoading && projectList.length === 0 && (
              <div className="py-1.5 pl-8 pr-2 text-sm text-muted-foreground">
                No projects
              </div>
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
