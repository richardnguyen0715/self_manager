import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { FocusFeature } from "@/features/focus";

export const metadata: Metadata = {
  title: "Focus",
  description: "Pomodoro timer, deep-work sessions, and focus statistics.",
};

export default function FocusPage() {
  return (
    <AppShell title="Focus">
      <FocusFeature />
    </AppShell>
  );
}
