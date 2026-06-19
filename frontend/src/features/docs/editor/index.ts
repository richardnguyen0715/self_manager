/**
 * Docs editor — public barrel.
 *
 * Import from here for all editor-related components and types.
 *
 *   import { DocEditor, DocView } from "@/features/docs/editor";
 *   import type { DocEditorProps } from "@/features/docs/editor";
 */

export { DocEditor, DocView } from "./DocEditor";
export type { DocEditorProps, DocViewProps } from "./DocEditor";

export { DOC_TEMPLATES } from "./templates";
export type { DocTemplate } from "./templates";

export { TemplatesPicker } from "./TemplatesPicker";
export { Toolbar } from "./Toolbar";
export { SlashMenu, SLASH_ITEMS, buildSlashItems } from "./SlashMenu";
export type { SlashCommandItem, SlashMenuHandle, SlashItemsOptions } from "./SlashMenu";
export { UrlDialog } from "./UrlDialog";
export type { UrlDialogProps } from "./UrlDialog";
export { EmojiPicker } from "./EmojiPicker";

// Block menu (turn into / duplicate)
export { BlockMenu } from "./BlockMenu";
export type { BlockMenuState } from "./BlockMenu";

// Page mention list
export { PageMentionList } from "./PageMentionList";
export type { PageMentionListHandle } from "./PageMentionList";

// ── Extensions ────────────────────────────────────────────────────────────────

// Existing
export { InfoPanel } from "./extensions/InfoPanel";
export type { InfoPanelVariant } from "./extensions/InfoPanel";
export { Column, Columns } from "./extensions/Columns";
export { Mermaid } from "./extensions/Mermaid";
export { TableOfContents } from "./extensions/TableOfContents";

// V2 new extensions
export { Toggle, ToggleSummary } from "./extensions/Toggle";
export { Callout } from "./extensions/Callout";
export type { CalloutVariant } from "./extensions/Callout";
export { Bookmark } from "./extensions/Bookmark";
export type { BookmarkAttrs } from "./extensions/Bookmark";
export { Embed } from "./extensions/Embed";
export { DatabaseEmbed } from "./extensions/DatabaseEmbed";
export { PageMention } from "./extensions/PageMention";
export type { PageMentionAttrs } from "./extensions/PageMention";

// ── Node views ────────────────────────────────────────────────────────────────

// Existing
export { InfoPanelView } from "./node-views/InfoPanelView";
export { MermaidView } from "./node-views/MermaidView";
export { TableOfContentsView } from "./node-views/TableOfContentsView";

// V2 new node views
export { ToggleView } from "./node-views/ToggleView";
export { CalloutView } from "./node-views/CalloutView";
export { BookmarkView } from "./node-views/BookmarkView";
export { EmbedView } from "./node-views/EmbedView";
export { DatabaseEmbedView } from "./node-views/DatabaseEmbedView";
