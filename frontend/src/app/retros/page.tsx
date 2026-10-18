import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { RetrosView } from "@/features/retros";

export const metadata: Metadata = {
  title: "Retros",
  description:
    "Daily, weekly, monthly and scoped retrospectives with linked objects, action items and trends.",
};

export default function RetrosPage() {
  return (
    <AppShell title="Retros">
      <RetrosView />
    </AppShell>
  );
}
