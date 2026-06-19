"use client";

/**
 * DocsSpaceViewPage — client wrapper for the /docs/[spaceId] route.
 *
 * SpaceView is self-contained: it fetches the space + page tree, renders the
 * page-tree sidebar and list table, handles create/edit/delete, and navigates
 * to the page editor on page creation.
 * This wrapper exists to bridge the RSC route page into the client boundary.
 */

import { SpaceView } from "@/features/docs/spaces/SpaceView";

interface DocsSpaceViewPageProps {
  spaceId: string;
}

export function DocsSpaceViewPage({ spaceId }: DocsSpaceViewPageProps) {
  return <SpaceView spaceId={spaceId} />;
}
