import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { HabitList } from "@/features/habits";

export const metadata: Metadata = {
  title: "Habits",
  description: "Track daily and weekly habits, build streaks, and review your completion history.",
};

export default function HabitsPage() {
  return (
    <AppShell title="Habits">
      <HabitList />
    </AppShell>
  );
}
