// ─── Reviews feature local types ─────────────────────────────────────────────

/** Tab for the review page detail section. */
export type ReviewTab = "review" | "retrospective";

/** Form values for upserting a sprint review summary. */
export interface ReviewSummaryFormValues {
  summary: string;
}

/** Form values for upserting a retrospective. */
export interface RetroFormValues {
  went_well: string;
  went_wrong: string;
  action_items: { id: string; text: string; done: boolean }[];
}

/** Local action item being composed (before it has a persisted id). */
export interface DraftActionItem {
  localId: string;
  text: string;
}
