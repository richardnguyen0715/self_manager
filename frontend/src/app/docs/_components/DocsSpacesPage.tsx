"use client";

/**
 * DocsSpacesPage — client wrapper for the /docs index route.
 *
 * SpacesList is self-contained: it fetches data, manages create/edit/delete
 * dialogs, and handles search + view-mode toggle internally.
 * This wrapper exists only to satisfy the "use client" boundary requirement
 * so the Server Component route page (app/docs/page.tsx) stays RSC-safe.
 */

import { SpacesList } from "@/features/docs/spaces/SpacesList";

export function DocsSpacesPage() {
  return <SpacesList />;
}
