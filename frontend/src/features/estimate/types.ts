// ─── Estimate systems (catalog from GET /api/estimate-systems) ───────────────

/** One allowed story-points value and how it is shown. */
export interface EstimateValue {
  value: number;
  label: string;
}

/** Row returned by GET /api/estimate-systems. */
export interface EstimateSystem {
  id: string;
  label: string;
  unit: string;
  description: string;
  values: EstimateValue[];
}

/** Ids of the built-in systems (mirrors the backend catalog). */
export type EstimateSystemId =
  | "fibonacci"
  | "linear"
  | "tshirt"
  | "hours"
  | "none";

export const DEFAULT_ESTIMATE_SYSTEM_ID: EstimateSystemId = "fibonacci";

/** Select options for the project edit UI, in display order. */
export const ESTIMATE_SYSTEM_IDS: readonly EstimateSystemId[] = [
  "fibonacci",
  "linear",
  "tshirt",
  "hours",
  "none",
];
