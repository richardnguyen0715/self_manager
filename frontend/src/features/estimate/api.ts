import { api } from "@/lib/api";
import type { EstimateSystem } from "./types";

export const ESTIMATE_SYSTEMS_PATH = "/api/estimate-systems";

/** GET /api/estimate-systems — static catalog of estimate systems. */
export function fetchEstimateSystems() {
  return api.get<EstimateSystem[]>(ESTIMATE_SYSTEMS_PATH);
}
