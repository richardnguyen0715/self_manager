import { cn } from "@/lib/utils";

interface ItemKeyChipProps {
  /** Human-readable key such as "MML-12". Renders nothing when empty. */
  itemKey?: string | null;
  className?: string;
}

/** Small monospace, muted chip showing a work item key (e.g. MML-12). */
export function ItemKeyChip({ itemKey, className }: ItemKeyChipProps) {
  if (!itemKey) return null;
  return (
    <span
      title={itemKey}
      className={cn(
        "shrink-0 rounded border bg-muted/50 px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground",
        className,
      )}
    >
      {itemKey}
    </span>
  );
}
