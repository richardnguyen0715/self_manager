"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Space } from "@/features/docs";

interface DeleteSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: Space | null;
  onConfirm: (id: string) => void;
  isPending?: boolean;
}

export function DeleteSpaceDialog({
  open,
  onOpenChange,
  space,
  onConfirm,
  isPending = false,
}: DeleteSpaceDialogProps) {
  if (!space) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete space</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <span className="font-semibold text-foreground">
              {space.icon} {space.name}
            </span>{" "}
            and all its pages, versions, and comments. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(space.id)}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete space"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
