import { Suspense } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SearchPage } from "@/features/search";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search across tasks, projects, goals, habits, time blocks and calendar events.",
};

export default function SearchRoutePage() {
  return (
    <AppShell title="Search">
      {/*
       * Suspense boundary is required because SearchPage calls useSearchParams(),
       * which opts into dynamic rendering on the server.
       */}
      <Suspense>
        <SearchPage />
      </Suspense>
    </AppShell>
  );
}
