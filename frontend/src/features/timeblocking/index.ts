// ─── Feature barrel ───────────────────────────────────────────────────────────

// Store
export { useTimeBlockingStore } from "./timeblocking.store";
export type { ViewMode, DraftTimeBlock } from "./timeblocking.store";

// Hooks
export {
  useTimeBlocks,
  useTimeBlock,
  useCreateTimeBlock,
  useUpdateTimeBlock,
  useDeleteTimeBlock,
  timeBlockKeys,
} from "./hooks/useTimeBlocks";
export type {
  TimeBlockListParams,
  CreateTimeBlockPayload,
  UpdateTimeBlockPayload,
} from "./hooks/useTimeBlocks";

export {
  useFocusSessions,
  useStartFocusSession,
  usePauseFocusSession,
  useResumeFocusSession,
  useFinishFocusSession,
  getFocusSessionStatus,
  getFocusWorkMinutes,
  focusKeys,
} from "./hooks/useFocusSession";
export type { FocusMode, StartFocusSessionPayload } from "./hooks/useFocusSession";

export { useTaskSelector, taskSelectorKeys } from "./hooks/useTaskSelector";

// Components
export { TimeBlockingView } from "./components/TimeBlockingView";
export { TimeBlockGrid } from "./components/TimeBlockGrid";
export { TimeBlockCard } from "./components/TimeBlockCard";
export { TimeBlockEditor } from "./components/TimeBlockEditor";
export { TimeBlockList } from "./components/TimeBlockList";
export { TimeBlockDetailPanel } from "./components/TimeBlockDetailPanel";
export { FocusSessionPanel, FocusLaunchButton } from "./components/FocusSessionPanel";
export { DateNav } from "./components/DateNav";
