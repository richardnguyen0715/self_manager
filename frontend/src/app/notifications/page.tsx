import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationsView } from "@/features/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <AppShell title="Notifications">
      <NotificationsView />
    </AppShell>
  );
}
