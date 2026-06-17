"use client";

import { cn } from "@/lib/utils";

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

export function NotificationsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg px-4 py-3">
          <SkeletonLine className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-4 w-2/5" />
            <SkeletonLine className="h-3 w-full" />
            <SkeletonLine className="h-3 w-4/5" />
            <SkeletonLine className="h-2.5 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
