// ─── Components ────────────────────────────────────────────────────────────────
export { PropertiesPanel } from "./components/PropertiesPanel";
export { PropertyValueEditor } from "./components/PropertyValueEditor";
export { PropertyValueChip, optionChipStyle } from "./components/PropertyValueChip";
export { ProjectPropertiesManager } from "./components/ProjectPropertiesManager";

// ─── Hooks ─────────────────────────────────────────────────────────────────────
export {
  customPropertyKeys,
  useCustomProperties,
  useProjectPropertyValues,
  useWorkItemPropertyValues,
  useCreateCustomProperty,
  useUpdateCustomProperty,
  useDeleteCustomProperty,
  useSetPropertyValue,
  useListPropertyColumns,
} from "./hooks";
export type { ListPropertyCell } from "./hooks";

// ─── API ───────────────────────────────────────────────────────────────────────
export { CUSTOM_PROPERTY_ENDPOINTS } from "./api";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type {
  CustomProperty,
  PropertyType,
  PropertyOption,
  PropertyOptionInput,
  PropertyValue,
  WorkItemPropertyValue,
  ProjectPropertyValue,
  CreateCustomPropertyPayload,
  UpdateCustomPropertyPayload,
} from "./types";
export {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_OPTION_COLORS,
  DEFAULT_OPTION_COLOR,
  isOptionType,
} from "./types";
