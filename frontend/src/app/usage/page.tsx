import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { UsageGuide } from "@/features/usage/UsageGuide";

export const metadata: Metadata = {
  title: "Usage",
  description: "How to use every feature in ManageMyLife.",
};

export default function UsagePage() {
  return (
    <AppShell title="Usage">
      <UsageGuide />
    </AppShell>
  );
}
