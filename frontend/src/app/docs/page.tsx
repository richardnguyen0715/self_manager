import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DocsSpacesPage } from "./_components/DocsSpacesPage";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Confluence-style documentation — create spaces, write pages, and publish knowledge.",
};

export default function DocsPage() {
  return (
    <AppShell title="Docs">
      <DocsSpacesPage />
    </AppShell>
  );
}
