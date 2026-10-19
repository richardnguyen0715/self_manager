import type { EstimateSystem } from "./types";

/**
 * Display text for a stored story-points value.
 * null -> "—". A value listed by the system shows its label (tshirt "M",
 * hours "4h", others the number). Anything else, including values outside the
 * system's scale or a missing system, shows the raw number.
 */
export function formatEstimate(
  system: EstimateSystem | null | undefined,
  value: number | null | undefined,
): string {
  if (value == null) return "—";
  const match = system?.values.find((v) => v.value === value);
  if (match) {
    if (system?.id === "hours") return `${match.value}h`;
    return match.label;
  }
  return String(value);
}
