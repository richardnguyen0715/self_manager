/**
 * TipTap core module augmentation for all V2 custom extensions.
 *
 * Merged into @tiptap/core so that editor.chain().<command>() is type-safe
 * without casting to `any` at call sites.
 *
 * Each extension also declares its own augmentation in its own file; this
 * file serves as a consolidated single import for tooling.
 */

// Re-export the individual module augmentations so they are picked up by TSC.
export type {} from "./Toggle";
export type {} from "./Callout";
export type {} from "./Bookmark";
export type {} from "./Embed";
export type {} from "./DatabaseEmbed";
export type {} from "./PageMention";
