/**
 * Docs whiteboard feature — public barrel.
 *
 * The routes agent imports `Whiteboard` from here and renders it for any page
 * with kind='whiteboard'.
 *
 * Example (routes agent):
 *   import { Whiteboard } from "@/features/docs/whiteboard";
 *   ...
 *   <Whiteboard pageId={params.pageId} readOnly={false} />
 */

export { Whiteboard } from "./Whiteboard";
