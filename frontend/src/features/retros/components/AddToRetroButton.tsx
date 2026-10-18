"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddToWeeklyRetro } from "../hooks/useRetros";
import type { RetroLinkTargetType } from "../types";

export interface AddToRetroButtonProps {
  targetType: RetroLinkTargetType;
  targetId: string;
  /** Button text. Defaults to "Add to this week's review". */
  label?: string;
  className?: string;
}

/**
 * Opens this week's weekly retro (created if missing) and links the object to
 * it as `mentions`. Shows an inline confirmation with a link to the retro.
 */
export function AddToRetroButton({
  targetType,
  targetId,
  label = "Add to this week's review",
  className,
}: AddToRetroButtonProps) {
  const add = useAddToWeeklyRetro();
  const [added, setAdded] = useState<{ retroId: string; title: string } | null>(null);

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={add.isPending}
        onClick={() =>
          add.mutate(
            { targetType, targetId },
            {
              onSuccess: (res) => setAdded(res),
              onError: () => setAdded(null),
            },
          )
        }
      >
        {add.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : added ? (
          <Check className="h-4 w-4" />
        ) : (
          <CalendarDays className="h-4 w-4" />
        )}
        {label}
      </Button>

      {added ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Added to{" "}
          <Link href={`/retros/${added.retroId}`} className="underline hover:text-foreground">
            {added.title}
          </Link>
        </p>
      ) : null}
      {add.isError ? (
        <p className="mt-1.5 text-xs text-destructive">Could not add to this week&apos;s review.</p>
      ) : null}
    </div>
  );
}

