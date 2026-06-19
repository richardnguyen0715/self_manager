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
export { SlashMenu, SLASH_ITEMS } from "./SlashMenu";
export { EmojiPicker } from "./EmojiPicker";

// Extensions
export { InfoPanel } from "./extensions/InfoPanel";
export type { InfoPanelVariant } from "./extensions/InfoPanel";
export { Column, Columns } from "./extensions/Columns";
export { Mermaid } from "./extensions/Mermaid";
export { TableOfContents } from "./extensions/TableOfContents";

// Node views
export { InfoPanelView } from "./node-views/InfoPanelView";
export { MermaidView } from "./node-views/MermaidView";
export { TableOfContentsView } from "./node-views/TableOfContentsView";
