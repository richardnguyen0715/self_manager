"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Building2,
} from "lucide-react";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/features/tasks/hooks/useProjects";
import { useOrganizations } from "@/features/organization/hooks/useOrganizations";
import { useProjectStore } from "@/stores";
import { api } from "@/lib/api";
import { API_ENDPOINTS } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Project } from "@/types";

// The shared ProjectPayload (in useProjects.ts) is being broadened by the
// contract to include organization_id; until that lands locally we extend it
// here so we can pass the field through useUpdateProject without a type error.
type ProjectPatch = {
  name?: string;
  description?: string | null;
  color?: string | null;
  deadline?: string | null;
  organization_id?: string | null;
};

const NO_ORG = "__none__";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { data: organizations } = useOrganizations();
  const createMut = useCreateProject();
  const updateMut = useUpdateProject();
  const deleteMut = useDeleteProject();
  const { currentProjectId, setCurrentProject } = useProjectStore();
  const router = useRouter();

  const orgs = organizations ?? [];
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  function openProject(id: string) {
    setCurrentProject(id);
    router.push("/dashboard");
  }

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [organizationId, setOrganizationId] = useState<string>(NO_ORG);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  // Counts for the delete confirmation, fetched only when a target is set.
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["project-delete-counts", deleteTarget?.id],
    enabled: !!deleteTarget,
    queryFn: async () => {
      const id = deleteTarget!.id;
      const [wi, sp] = await Promise.all([
        api.get<{ total: number }>(API_ENDPOINTS.WORK_ITEMS, { project_id: id }),
        api.get<{ total: number }>(API_ENDPOINTS.SPRINTS, { project_id: id }),
      ]);
      return { workItems: wi.total ?? 0, sprints: sp.total ?? 0 };
    },
  });

  const list = projects ?? [];
  const busy = createMut.isPending || updateMut.isPending;

  // Group projects by their organization for display. Ordered by org position;
  // projects with no organization fall into a trailing "No organization" group.
  const groups: { id: string | null; label: string; projects: Project[] }[] =
    (() => {
      const byOrg = new Map<string | null, Project[]>();
      for (const p of list) {
        const key = p.organization_id ?? null;
        const arr = byOrg.get(key);
        if (arr) arr.push(p);
        else byOrg.set(key, [p]);
      }
      const ordered: { id: string | null; label: string; projects: Project[] }[] =
        [];
      // Known orgs first, in their configured order.
      for (const o of [...orgs].sort((a, b) => a.position - b.position)) {
        const ps = byOrg.get(o.id);
        if (ps && ps.length) {
          ordered.push({ id: o.id, label: o.name, projects: ps });
          byOrg.delete(o.id);
        }
      }
      // Any orgs not in the orgs list (e.g. stale) but referenced by projects.
      for (const [key, ps] of byOrg) {
        if (key === null) continue;
        ordered.push({
          id: key,
          label: orgById.get(key)?.name ?? "Unknown organization",
          projects: ps,
        });
      }
      // Unassigned last.
      const none = byOrg.get(null);
      if (none && none.length) {
        ordered.push({ id: null, label: "No organization", projects: none });
      }
      return ordered;
    })();
  // Only show group headers once there is at least one organization to group by.
  const showGroups = orgs.length > 0;

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setOrganizationId(NO_ORG);
    setOpen(true);
  }
  function openEdit(p: Project) {
    setEditing(p);
    setName(p.name);
    setDescription(p.description ?? "");
    setOrganizationId(p.organization_id ?? NO_ORG);
    setOpen(true);
  }
  function submit() {
    const n = name.trim();
    if (!n) return;
    const payload: ProjectPatch = {
      name: n,
      description: description.trim() || null,
      organization_id: organizationId === NO_ORG ? null : organizationId,
    };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, payload },
        { onSuccess: () => setOpen(false) },
      );
    } else {
      createMut.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  }

  /** Quick per-card org assignment without opening the full edit dialog. */
  function assignOrg(p: Project, orgId: string) {
    const payload: ProjectPatch = {
      organization_id: orgId === NO_ORG ? null : orgId,
    };
    updateMut.mutate({ id: p.id, payload });
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    deleteMut.mutate(id, {
      onSuccess: () => {
        if (currentProjectId === id) setCurrentProject(null);
        setDeleteTarget(null);
      },
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Organize sprints, backlog and work items by project.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          New project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first project
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.id ?? "__none__"} className="flex flex-col gap-2">
              {showGroups && (
                <div className="flex items-center gap-2 px-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </h2>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {g.projects.length}
                  </span>
                </div>
              )}
              {g.projects.map((p) => (
                <Card
                  key={p.id}
                  className="group flex items-center gap-3 px-4 py-3"
                >
                  <span
                    className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: (p.color ?? "#6366f1") + "22" }}
                  >
                    <FolderOpen
                      className="h-4 w-4"
                      style={{ color: p.color ?? "#6366f1" }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.name}</span>
                      {currentProjectId === p.id && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                  {orgs.length > 0 && (
                    <select
                      value={p.organization_id ?? NO_ORG}
                      onChange={(e) => assignOrg(p, e.target.value)}
                      disabled={updateMut.isPending}
                      aria-label="Assign project to organization"
                      title="Assign to organization"
                      className="h-8 max-w-[10rem] shrink-0 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground shadow-sm outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value={NO_ORG}>No organization</option>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant={
                        currentProjectId === p.id ? "secondary" : "ghost"
                      }
                      size="sm"
                      onClick={() => openProject(p.id)}
                    >
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(p)}
                      aria-label="Edit project"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                      aria-label="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Organization
              </label>
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value={NO_ORG}>No organization</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={!name.trim() || busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editing ? (
                "Save"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation with item/sprint counts */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Delete <span className="font-semibold">{deleteTarget?.name}</span>?
            </p>
            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              {countsLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Counting items…
                </span>
              ) : (
                <ul className="space-y-1">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Work items</span>
                    <span className="font-semibold tabular-nums">
                      {counts?.workItems ?? 0}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Sprints</span>
                    <span className="font-semibold tabular-nums">
                      {counts?.sprints ?? 0}
                    </span>
                  </li>
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The project will be deleted. Its work items and sprints are kept
              but detached (moved to no project).
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete project"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
