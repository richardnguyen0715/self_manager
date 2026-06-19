/**
 * Database feature barrel.
 *
 * Primary exports:
 *   - DatabaseView     — full-page database view (Table + Board tabs)
 *   - DatabaseEmbed    — compact embedded block (for TipTap databaseEmbed node)
 *
 * All components are client-only ('use client' is in each file).
 * The editor node lazy-imports DatabaseEmbed from this barrel:
 *   const { DatabaseEmbed } = await import("@/features/docs/database");
 */

export { DatabaseView } from "./DatabaseView";
export type { DatabaseEmbedProps } from "./DatabaseEmbed";
export { DatabaseEmbed } from "./DatabaseEmbed";
export { TableView } from "./TableView";
export { BoardView } from "./BoardView";
export { CellRenderer } from "./CellRenderer";
export { ColumnMenu, AddColumnButton, ColTypeIcon } from "./ColumnManager";
export { FilterSortBar } from "./FilterSortBar";
export { RowEditor } from "./RowEditor";
export {
  COLUMN_TYPE_META,
  ALL_COLUMN_TYPES,
  DEFAULT_STATUS_OPTIONS,
  formatCellValue,
  randomOptionColor,
  newOptionId,
} from "./column-utils";
