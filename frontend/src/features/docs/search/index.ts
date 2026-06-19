/**
 * features/docs/search — public barrel.
 *
 * Search area: debounced hook + result items + grouped palette section +
 * standalone /docs/search page.
 */

// Hooks
export { useDocsSearchDebounced } from "./hooks/useDocsSearchDebounced";

// Components
export { DocsSearchResultItem } from "./components/DocsSearchResultItem";
export { DocsSearchGroup } from "./components/DocsSearchGroup";
export { DocsSearchPage } from "./components/DocsSearchPage";

// Types
export type {
  DocsHit,
  DocsPageHit,
  DocsDatabaseHit,
  DocsHitKind,
} from "./components/DocsSearchResultItem";
