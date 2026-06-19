"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// Lazy-load the heavy database view to keep the initial bundle light.
const DatabaseView = dynamic(
  () =>
    import("@/features/docs/database").then((m) => ({ default: m.DatabaseView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    ),
  },
);

interface DatabasePageProps {
  databaseId: string;
}

/**
 * Client wrapper for the standalone /docs/db/[id] route.
 * Renders DatabaseView inside a full-page flex container.
 */
export function DatabasePage({ databaseId }: DatabasePageProps) {
  return (
    <div className={cn("flex flex-col h-full -mx-4 -my-4 md:-mx-6 md:-my-4 lg:-mx-8")}>
      <DatabaseView databaseId={databaseId} />
    </div>
  );
}
