import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { ReviewsView } from "@/features/reviews";

export const metadata: Metadata = {
  title: "Reviews",
  description:
    "Sprint Review — planned vs completed story points and velocity. Retrospective — what went well, what went wrong, and action items.",
};

export default function ReviewsPage() {
  return (
    <AppShell title="Reviews">
      <ReviewsView />
    </AppShell>
  );
}
