"use client";

import { useState } from "react";
import { Check, ChevronDown, FolderOpen, Loader2, Plus } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores";
import { useProjects, projectKeys } from "@/features/tasks/hooks/useProjects";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import type { Project } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProjectSwitcherProps {
  /** When the sidebar is collapsed we only show the icon. */
  collapsed?: boolean;
}

export function ProjectSwitcher({ collapsed = false }: ProjectSwitcherProps) {
  const { currentProjectId, setCurrentProject } = useProjectStore();
  const { data: projects, isLoading } = useProjects();
  const qc = useQueryClient();

  const [selectOpen, setSelectOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: (n: string) =>
      api.post<Project>(API_ENDPOINTS.PROJECTS, { name: n }),
    onSuccess: (proj) => {
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      if (proj?.id) setCurrentProject(proj.id);
      setName("");
      setDialogOpen(false);
    },
  });

  function submit() {
    const n = name.trim();
    if (n) create.mutate(n);
  }

  const projectList = projects ?? [];
  const selectedName =
    currentProjectId == null
      ? "All projects"
      : (projectList.find((p) => p.id === currentProjectId)?.name ??
        "All projects");

  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <SelectPrimitive.Root
        open={selectOpen}
        onOpenChange={setSelectOpen}
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
              <span className="truncate text-xs font-medium">
                {selectedName}
              </span>
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
                <SelectPrimitive.ItemText>
                  All projects
                </SelectPrimitive.ItemText>
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

              {/* New project action */}
              <div className="mt-1 border-t pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectOpen(false);
                    setDialogOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm py-1.5 px-2 text-sm font-medium text-primary outline-none hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>New project</span>
                </button>
              </div>
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={!name.trim() || create.isPending}>
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
