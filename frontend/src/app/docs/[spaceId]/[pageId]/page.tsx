import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DocsPageEditorPage } from "../../_components/DocsPageEditorPage";

export const metadata: Metadata = {
  title: "Page Editor",
  description: "Write and publish documentation pages.",
};

interface Props {
  params: Promise<{ spaceId: string; pageId: string }>;
}

export default async function PageEditorPage({ params }: Props) {
  const { spaceId, pageId } = await params;
  return (
    // No title prop — editor has its own full-bleed layout with title input
    <AppShell>
      <DocsPageEditorPage spaceId={spaceId} pageId={pageId} />
    </AppShell>
  );
}
