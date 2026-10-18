"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarRange, Plus, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useOpenRetro, useRetroTemplates } from "../hooks/useRetros";
import { todayISO } from "../format";
import type { OpenRetroPayload, RetroKind, RetroScopeType } from "../types";
import { RETRO_KIND_LABELS, RETRO_SCOPE_LABELS } from "../types";
import { ObjectPicker, type PickedObject } from "./ObjectPicker";

const ALL_KINDS: RetroKind[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "sprint",
  "project",
  "custom",
];

const ALL_SCOPES: RetroScopeType[] = [
  "none",
  "sprint",
  "project",
  "epic",
  "initiative",
  "goal",
  "work_item",
  "habit",
];

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Header buttons that open a period retro (idempotent on the server) and
 * navigate to it, plus the "New scoped retro…" dialog.
 */
export function QuickOpenBar() {
  const router = useRouter();
  const open = useOpenRetro();
  const [scopedOpen, setScopedOpen] = useState(false);

  const openPeriod = (kind: RetroKind) => {
    open.mutate(
      { kind, date: todayISO() },
      { onSuccess: (d) => router.push(`/retros/${d.retro.id}`) },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={open.isPending}
        onClick={() => openPeriod("daily")}
      >
        <Sun className="h-4 w-4" />
        Today&apos;s check-in
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={open.isPending}
        onClick={() => openPeriod("weekly")}
      >
        <CalendarDays className="h-4 w-4" />
        This week
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={open.isPending}
        onClick={() => openPeriod("monthly")}
      >
        <CalendarRange className="h-4 w-4" />
        This month
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setScopedOpen(true)}
      >
        <Plus className="h-4 w-4" />
        New scoped retro…
      </Button>

      {open.isError ? (
        <span className="text-xs text-destructive">Could not open the retro.</span>
      ) : null}

      {scopedOpen ? (
        <NewScopedRetroDialog open onOpenChange={setScopedOpen} />
      ) : null}
    </div>
  );
}

// ─── New scoped retro dialog ──────────────────────────────────────────────────

interface NewScopedRetroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a scope (e.g. "New retro" from a sprint page). */
  defaultScope?: { scopeType: RetroScopeType; scopeId: string; label: string };
  defaultKind?: RetroKind;
}

export function NewScopedRetroDialog({
  open,
  onOpenChange,
  defaultScope,
  defaultKind,
}: NewScopedRetroDialogProps) {
  const router = useRouter();
  const openRetro = useOpenRetro();
  const templates = useRetroTemplates();

  const [kind, setKind] = useState<RetroKind>(
    defaultKind ?? (defaultScope?.scopeType === "sprint" ? "sprint" : "custom"),
  );
  const [scopeType, setScopeType] = useState<RetroScopeType>(
    defaultScope?.scopeType ?? "sprint",
  );
  const [picked, setPicked] = useState<PickedObject | null>(
    defaultScope
      ? {
          targetType: defaultScope.scopeType as Exclude<RetroScopeType, "none">,
          targetId: defaultScope.scopeId,
          title: defaultScope.label,
        }
      : null,
  );
  const [templateId, setTemplateId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState("");

  const matchingTemplates = useMemo(
    () => (templates.data ?? []).filter((t) => t.kind === kind),
    [templates.data, kind],
  );

  const scopeNeedsObject = scopeType !== "none";
  const canSubmit =
    !openRetro.isPending && (!scopeNeedsObject || Boolean(picked));

  const submit = () => {
    const payload: OpenRetroPayload = {
      kind,
      date,
      scope_type: scopeType,
      scope_id: scopeNeedsObject && picked ? picked.targetId : null,
      template_id: templateId || null,
      title: title.trim() || undefined,
    };
    openRetro.mutate(payload, {
      onSuccess: (d) => {
        onOpenChange(false);
        router.push(`/retros/${d.retro.id}`);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New scoped retro</DialogTitle>
          <DialogDescription>
            Pick a kind and what it is about. Reopening the same kind, period and
            scope returns the existing retro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="retro-kind">Kind</Label>
              <select
                id="retro-kind"
                className={selectClass}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as RetroKind);
                  setTemplateId("");
                }}
              >
                {ALL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {RETRO_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retro-date">Date</Label>
              <input
                id="retro-date"
                type="date"
                className={selectClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retro-scope">Scope</Label>
            <select
              id="retro-scope"
              className={selectClass}
              value={scopeType}
              onChange={(e) => {
                setScopeType(e.target.value as RetroScopeType);
                setPicked(null);
              }}
            >
              {ALL_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {RETRO_SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {scopeNeedsObject ? (
            <div className="space-y-2 rounded-md border p-3">
              {picked ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    <span className="text-muted-foreground">Selected: </span>
                    {picked.title}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setPicked(null)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <ObjectPicker
                  key={scopeType}
                  types={[scopeType as Exclude<RetroScopeType, "none">]}
                  onPick={setPicked}
                />
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="retro-template">Template</Label>
            <select
              id="retro-template"
              className={cn(selectClass)}
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">Default for {RETRO_KIND_LABELS[kind].toLowerCase()}</option>
              {matchingTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.is_builtin ? "" : " (custom)"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="retro-title">Title (optional)</Label>
            <Input
              id="retro-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Generated from kind and scope if empty"
            />
          </div>
        </div>

        {openRetro.isError ? (
          <p className="text-sm text-destructive">Could not create the retro. Check the selection and try again.</p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            Open retro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
