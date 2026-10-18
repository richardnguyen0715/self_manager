// ─── Components ────────────────────────────────────────────────────────────────
export { LabelChip, labelChipStyle } from "./components/LabelChip";
export { LabelPicker } from "./components/LabelPicker";
export { LabelColorSwatches } from "./components/LabelColorSwatches";
export { LabelsManager } from "./components/LabelsManager";

// ─── Hooks ─────────────────────────────────────────────────────────────────────
export {
  useLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  labelKeys,
} from "./hooks/useLabels";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type { Label, CreateLabelPayload, UpdateLabelPayload } from "./types";
export { DEFAULT_LABEL_COLOR, LABEL_COLOR_PRESETS } from "./types";
export { LabelsField } from "./components/LabelsField";
