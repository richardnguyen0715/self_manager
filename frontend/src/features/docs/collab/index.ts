/**
 * Docs collab — public barrel.
 *
 * Exports the CollabRail (right-rail / slide-over), its standalone trigger
 * button, and the individual panels for use by the routes/editor agents.
 *
 * Usage in the page editor route:
 *
 *   import { CollabRail, CollabRailTrigger } from "@/features/docs/collab";
 *
 *   // In toolbar:
 *   <CollabRailTrigger onClick={() => setCollabOpen((v) => !v)} />
 *
 *   // Beside/over the editor:
 *   <CollabRail
 *     pageId={pageId}
 *     open={collabOpen}
 *     onClose={() => setCollabOpen(false)}
 *     onVersionRestored={() => router.refresh()}
 *   />
 */

export { CollabRail, CollabRailTrigger } from "./CollabRail";
export { VersionHistoryPanel } from "./VersionHistoryPanel";
export { CommentsPanel } from "./CommentsPanel";
