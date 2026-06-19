import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DocsPublishedPage } from "../../../_components/DocsPublishedPage";

export const metadata: Metadata = {
  title: "Published Page",
  description: "Read-only view of a published documentation page.",
};

interface Props {
  params: Promise<{ spaceId: string; pageId: string }>;
}

export default async function PublishedPage({ params }: Props) {
  const { spaceId, pageId } = await params;
  return (
    <AppShell>
      <DocsPublishedPage spaceId={spaceId} pageId={pageId} />
    </AppShell>
  );
}
