"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from "@/features/organization/hooks/useOrganizations";
import { useProjects } from "@/features/tasks/hooks/useProjects";
import { useOrganizationStore } from "@/stores";
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
import type { Organization } from "@/types";

export default function OrganizationsPage() {
  const { data: organizations, isLoading } = useOrganizations();
  const { data: projects } = useProjects();
  const createMut = useCreateOrganization();
  const updateMut = useUpdateOrganization();
  const deleteMut = useDeleteOrganization();
  const { currentOrganizationId, setCurrentOrganization } =
    useOrganizationStore();
  const router = useRouter();

  function openOrganization(id: string) {
    setCurrentOrganization(id);
    router.push("/projects");
  }

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);

  const list = organizations ?? [];
  const busy = createMut.isPending || updateMut.isPending;

  // Project count per org (from the lightweight project list).
  function projectCount(orgId: string) {
    return (projects ?? []).filter((p) => p.organization_id === orgId).length;
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setColor("");
    setOpen(true);
  }
  function openEdit(o: Organization) {
    setEditing(o);
    setName(o.name);
    setDescription(o.description ?? "");
    setColor(o.color ?? "");
    setOpen(true);
  }
  function submit() {
    const n = name.trim();
    if (!n) return;
    const payload = {
      name: n,
      description: description.trim() || null,
      color: color.trim() || null,
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
  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    deleteMut.mutate(id, {
      onSuccess: () => {
        if (currentOrganizationId === id) setCurrentOrganization(null);
        setDeleteTarget(null);
      },
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Group your projects under organizations.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          New organization
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No organizations yet.
          </p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first organization
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((o) => {
            const count = projectCount(o.id);
            return (
              <Card
                key={o.id}
                className="group flex items-center gap-3 px-4 py-3"
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: (o.color ?? "#6366f1") + "22" }}
                >
                  <Building2
                    className="h-4 w-4"
                    style={{ color: o.color ?? "#6366f1" }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{o.name}</span>
                    {currentOrganizationId === o.id && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        Active
                      </span>
                    )}
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {count} {count === 1 ? "project" : "projects"}
                    </span>
                  </div>
                  {o.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {o.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant={
                      currentOrganizationId === o.id ? "secondary" : "ghost"
                    }
                    size="sm"
                    onClick={() => openOrganization(o.id)}
                  >
                    Projects
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(o)}
                    aria-label="Edit organization"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(o)}
                    aria-label="Delete organization"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit organization" : "New organization"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="Organization name"
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
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground" htmlFor="org-color">
                Color
              </label>
              <input
                id="org-color"
                type="color"
                value={color || "#6366f1"}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border border-input bg-background"
              />
              {color && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColor("")}
                >
                  Reset
                </Button>
              )}
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

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete organization
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Delete{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>?
            </p>
            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              <ul className="space-y-1">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Projects</span>
                  <span className="font-semibold tabular-nums">
                    {deleteTarget ? projectCount(deleteTarget.id) : 0}
                  </span>
                </li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              The organization will be deleted. Its projects are kept but
              detached (moved to no organization).
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
                "Delete organization"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
