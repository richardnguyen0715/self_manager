import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { DocsSpaceViewPage } from "../_components/DocsSpaceViewPage";

// Dynamic title via generateMetadata — space name fetched client-side,
// so we provide a static fallback here.
export const metadata: Metadata = {
  title: "Space",
  description: "Browse pages in this documentation space.",
};

interface Props {
  params: Promise<{ spaceId: string }>;
}

export default async function SpaceViewPage({ params }: Props) {
  const { spaceId } = await params;
  return (
    <AppShell>
      <DocsSpaceViewPage spaceId={spaceId} />
    </AppShell>
  );
}
