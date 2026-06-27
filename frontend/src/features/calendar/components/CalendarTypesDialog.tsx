"use client";

import { useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalendarType } from "@/types";
import {
  useCalendarTypes,
  useCreateCalendarType,
  useUpdateCalendarType,
  useDeleteCalendarType,
  type CreateCalendarTypePayload,
} from "../hooks/useCalendarTypes";

const DEFAULT_COLOR = "#3b82f6";

interface FormState {
  name: string;
  color: string;
  icon: string;
  description: string;
  default_all_day: boolean;
  default_reminder_minutes: string; // text input; "" = none
}

const EMPTY_FORM: FormState = {
  name: "",
  color: DEFAULT_COLOR,
  icon: "",
  description: "",
  default_all_day: false,
  default_reminder_minutes: "",
};

function toForm(t: CalendarType): FormState {
  return {
    name: t.name,
    color: t.color,
    icon: t.icon ?? "",
    description: t.description ?? "",
    default_all_day: t.default_all_day,
    default_reminder_minutes:
      t.default_reminder_minutes != null ? String(t.default_reminder_minutes) : "",
  };
}

function toPayload(f: FormState): CreateCalendarTypePayload {
  const minutes = f.default_reminder_minutes.trim();
  return {
    name: f.name.trim(),
    color: f.color.trim() || DEFAULT_COLOR,
    icon: f.icon.trim() || null,
    description: f.description.trim() || null,
    default_all_day: f.default_all_day,
    default_reminder_minutes: minutes ? Number(minutes) : null,
  };
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export function CalendarTypesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: types = [], isLoading } = useCalendarTypes();
  const createType = useCreateCalendarType();
  const updateType = useUpdateCalendarType();
  const deleteType = useDeleteCalendarType();

  // null = not editing; "new" = creating; otherwise editing that id.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const isBusy = createType.isPending || updateType.isPending;

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
  }

  function startEdit(t: CalendarType) {
    setForm(toForm(t));
    setEditingId(t.id);
  }

  function cancelForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim()) return;
    const payload = toPayload(form);
    if (editingId === "new") {
      await createType.mutateAsync(payload);
    } else if (editingId) {
      await updateType.mutateAsync({ id: editingId, ...payload });
    }
    cancelForm();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="w-[95vw] max-w-full sm:w-auto sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendars</DialogTitle>
        </DialogHeader>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {types.length === 0 && editingId === null && (
              <p className="text-sm text-muted-foreground py-2">
                No calendars yet. Create one to group and colour your events.
              </p>
            )}
            {types.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border"
                  style={{ backgroundColor: t.color }}
                />
                <span className="flex-1 truncate text-sm font-medium">
                  {t.icon && <span className="mr-1">{t.icon}</span>}
                  {t.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => startEdit(t)}
                  aria-label="Edit calendar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  disabled={deleteType.isPending}
                  onClick={() => deleteType.mutate(t.id)}
                  aria-label="Delete calendar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Inline create/edit form */}
        {editingId !== null ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {editingId === "new" ? "New calendar" : "Edit calendar"}
              </p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelForm}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
              <input
                type="color"
                aria-label="Calendar color"
                className="h-9 w-9 rounded border cursor-pointer p-0.5 bg-transparent"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
              <Input
                placeholder="Name (e.g. Work, Health)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Icon (emoji)</Label>
                <Input
                  placeholder="📅"
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Default reminder (min)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="none"
                  value={form.default_reminder_minutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, default_reminder_minutes: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Optional"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border accent-primary"
                checked={form.default_all_day}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_all_day: e.target.checked }))
                }
              />
              Events of this type default to all-day
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelForm} disabled={isBusy}>
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={isBusy || !form.name.trim()}>
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={startCreate} className="w-full">
            <Plus className="h-4 w-4" /> New calendar
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
