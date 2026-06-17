import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsView } from "@/features/settings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your profile, account security, notifications, and appearance.",
};

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <SettingsView />
    </AppShell>
  );
}
