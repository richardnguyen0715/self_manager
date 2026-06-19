import { Suspense } from "react";
import { DocsSearchPage } from "@/features/docs/search";

/**
 * /docs/search — standalone docs search page.
 *
 * Wrapped in Suspense because DocsSearchPage calls useSearchParams()
 * (a client-side hook that requires the searchParams boundary).
 */
export const metadata = {
  title: "Docs Search",
  description: "Search across pages and databases.",
};

export default function DocsSearchRoute() {
  return (
    <Suspense>
      <DocsSearchPage />
    </Suspense>
  );
}
