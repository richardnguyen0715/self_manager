"use client";

import Link from "next/link";
import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  FileText,
  FolderOpen,
  Layers,
  ListTodo,
  Network,
  NotebookPen,
  Plus,
  Repeat2,
  Rocket,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAddRetroLink, useRemoveRetroLink } from "../hooks/useRetroChildren";
import type { LinkResolved, RetroLinkTargetType } from "../types";
import { RETRO_LINK_TYPE_LABELS } from "../types";
import { ObjectPicker, type PickedObject } from "./ObjectPicker";

const TYPE_ICONS: Record<RetroLinkTargetType, LucideIcon> = {
  work_item: ListTodo,
  sprint: Rocket,
  project: FolderOpen,
  epic: Layers,
  initiative: Network,
  goal: Target,
  habit: Repeat2,
  doc: FileText,
  retro: NotebookPen,
};

/** Types a user can link from a retro page (retro-to-retro is not offered here). */
export const LINKABLE_TARGET_TYPES: RetroLinkTargetType[] = [
  "work_item",
  "sprint",
  "project",
  "epic",
  "initiative",
  "goal",
  "habit",
  "doc",
];

interface LinkedObjectsProps {
  retroId: string;
  links: LinkResolved[];
  readOnly?: boolean;
}

/** Chips for every linked object, plus a "Link object" popover with type tabs and search. */
export function LinkedObjects({ retroId, links, readOnly = false }: LinkedObjectsProps) {
  const [open, setOpen] = useState(false);
  const add = useAddRetroLink(retroId);
  const remove = useRemoveRetroLink(retroId);

  const handlePick = (picked: PickedObject) => {
    add.mutate(
      { target_type: picked.targetType, target_id: picked.targetId, relation: "about" },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing linked yet.</p>
        ) : null}
        {links.map((link) => (
          <LinkChip
            key={link.id}
            link={link}
            onRemove={readOnly ? undefined : () => remove.mutate(link.id)}
          />
        ))}
      </div>

      {readOnly ? null : (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Link object
            </Button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={6}
              className="z-50 w-80 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none"
            >
              {open ? (
                <ObjectPicker
                  types={LINKABLE_TARGET_TYPES}
                  onPick={handlePick}
                />
              ) : null}
              {add.isError ? (
                <p className="mt-2 text-xs text-destructive">
                  Could not link that object. Try again.
                </p>
              ) : null}
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </div>
  );
}

function LinkChip({
  link,
  onRemove,
}: {
  link: LinkResolved;
  onRemove?: () => void;
}) {
  const Icon = TYPE_ICONS[link.target_type] ?? FileText;
  const label = link.title ?? RETRO_LINK_TYPE_LABELS[link.target_type];
  const body = (
    <>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
      {link.subtitle ? (
        <span className="shrink-0 text-xs text-muted-foreground">{link.subtitle}</span>
      ) : null}
    </>
  );
  const chipClass =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs";

  return (
    <span className={cn(chipClass, "group")}>
      {link.href ? (
        <Link
          href={link.href}
          className="inline-flex min-w-0 items-center gap-1.5 hover:underline"
        >
          {body}
        </Link>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1.5">{body}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Unlink ${label}`}
          className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
