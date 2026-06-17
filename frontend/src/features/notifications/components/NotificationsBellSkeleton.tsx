"use client";

import { cn } from "@/lib/utils";

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-muted",
        className,
      )}
    />
  );
}

export function NotificationsBellSkeleton() {
  return (
    <div className="space-y-1 py-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-3 py-2.5">
          <SkeletonLine className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <SkeletonLine className="h-3.5 w-3/4" />
            <SkeletonLine className="h-3 w-full" />
            <SkeletonLine className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
