"use client";

/**
 * PageTemplatesPicker — shown when creating a new page.
 *
 * Supports two modes:
 * 1. "local" – applies a static TipTap JSON template into the current editor
 *    (for an already-created page that is still empty). Calls `onSelectContent`.
 * 2. "server" – creates a new page by deep-copying a server template via
 *    `useCreateFromTemplate`. Calls `onSelectFromServer` with the created Page.
 *
 * Always provides the four built-in templates (blank, 1-on-1, 4Ls, 5Whys).
 * When `spaceId` is provided it also loads templates marked `is_template=true`
 * from the API and lists them as an extra section.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ClipboardList, RotateCcw, Users, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOC_TEMPLATES } from "@/features/docs/editor/templates";
import { usePageTemplates, useCreateFromTemplate } from "@/features/docs";
import type { TipTapDoc, Page } from "@/types";

// ── Icons for built-in templates ──────────────────────────────────────────────

const BUILT_IN_ICONS: Record<string, React.ElementType> = {
  blank: FileText,
  "1on1": Users,
  "4ls": ClipboardList,
  "5whys": RotateCcw,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PageTemplatesPickerProps {
  open: boolean;
  onClose: () => void;
  /** Space id — used to fetch server-side templates and to create from template. */
  spaceId?: string;
  /** Parent page id — used when creating from a server template. */
  parentId?: string;

  /**
   * Called when the user picks a built-in template (local content application).
   * The caller should apply this JSON to the TipTap editor.
   */
  onSelectContent?: (content: TipTapDoc) => void;

  /**
   * Called when the user creates a page from a server template.
   * The caller should navigate to the new page.
   */
  onSelectFromServer?: (page: Page) => void;
}

// ── Template card ─────────────────────────────────────────────────────────────

interface TemplateCardProps {
  id: string;
  label: string;
  description: string;
  icon?: React.ElementType;
  emoji?: string;
  isSelected: boolean;
  onSelect: () => void;
}

function TemplateCard({
  label,
  description,
  icon: Icon,
  emoji,
  isSelected,
  onSelect,
}: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded text-base",
            isSelected ? "bg-primary/10" : "bg-muted",
          )}
        >
          {emoji ? (
            <span>{emoji}</span>
          ) : Icon ? (
            <Icon
              className={cn(
                "h-4 w-4",
                isSelected ? "text-primary" : "text-muted-foreground",
              )}
            />
          ) : (
            <FileText
              className={cn(
                "h-4 w-4",
                isSelected ? "text-primary" : "text-muted-foreground",
              )}
            />
          )}
        </span>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
        {description}
      </p>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type SelectionKind = { kind: "builtin"; id: string } | { kind: "server"; id: string };

export function PageTemplatesPicker({
  open,
  onClose,
  spaceId,
  parentId,
  onSelectContent,
  onSelectFromServer,
}: PageTemplatesPickerProps) {
  const [selected, setSelected] = React.useState<SelectionKind>({
    kind: "builtin",
    id: "blank",
  });
  const [applyPending, setApplyPending] = React.useState(false);

  // Server-side templates
  const serverTemplates = usePageTemplates(spaceId);
  const createFromTemplate = useCreateFromTemplate();

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelected({ kind: "builtin", id: "blank" });
      setApplyPending(false);
    }
  }, [open]);

  async function handleApply() {
    if (selected.kind === "builtin") {
      const tmpl = DOC_TEMPLATES.find((t) => t.id === selected.id);
      if (tmpl) {
        onSelectContent?.(tmpl.content);
      }
      onClose();
      return;
    }

    // Server template — create a new page
    if (!spaceId) {
      onClose();
      return;
    }
    setApplyPending(true);
    try {
      const page = await createFromTemplate.mutateAsync({
        space_id: spaceId,
        parent_id: parentId,
        template_id: selected.id,
      });
      onSelectFromServer?.(page);
      onClose();
    } catch {
      // leave dialog open; user can retry
    } finally {
      setApplyPending(false);
    }
  }

  const serverTemplatesList = serverTemplates.data ?? [];
  const hasServerTemplates = serverTemplatesList.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            Start your page from a preset layout or pick blank to begin from scratch.
          </DialogDescription>
        </DialogHeader>

        {/* Built-in templates section */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-0.5">
            Built-in
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DOC_TEMPLATES.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                id={tmpl.id}
                label={tmpl.label}
                description={tmpl.description}
                icon={BUILT_IN_ICONS[tmpl.id]}
                isSelected={selected.kind === "builtin" && selected.id === tmpl.id}
                onSelect={() => setSelected({ kind: "builtin", id: tmpl.id })}
              />
            ))}
          </div>
        </div>

        {/* Server templates section */}
        {spaceId && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-0.5">
              Workspace templates
            </p>
            {serverTemplates.isLoading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading templates…
              </div>
            ) : !hasServerTemplates ? (
              <p className="py-2 text-xs text-muted-foreground">
                No workspace templates yet. Mark a page as a template to see it here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {serverTemplatesList.map((tmpl) => (
                  <TemplateCard
                    key={tmpl.id}
                    id={tmpl.id}
                    label={tmpl.title || "Untitled Template"}
                    description="Workspace template"
                    emoji={tmpl.icon ?? undefined}
                    icon={BookOpen}
                    isSelected={selected.kind === "server" && selected.id === tmpl.id}
                    onSelect={() => setSelected({ kind: "server", id: tmpl.id })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={applyPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={applyPending}>
            {applyPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </>
            ) : (
              "Use template"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
