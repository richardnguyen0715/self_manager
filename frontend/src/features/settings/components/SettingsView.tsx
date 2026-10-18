"use client";

import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { useSettingsUIStore } from "../settings.store";
import { SettingsSidebar } from "./SettingsSidebar";
import { ProfileSection } from "./ProfileSection";
import { AccountSection } from "./AccountSection";
import { NotificationsSection } from "./NotificationsSection";
import { AppearanceSection } from "./AppearanceSection";
import { LabelsSection } from "./LabelsSection";

function SettingsContent() {
  const activeSection = useSettingsUIStore((s) => s.activeSection);

  return (
    <div className="flex flex-col md:flex-row gap-0 md:gap-8 min-h-full">
      <SettingsSidebar />

      {/* Divider: horizontal on mobile, vertical on md+ */}
      <div className="h-px md:h-auto md:w-px bg-border shrink-0 my-2 md:my-0" aria-hidden="true" />

      {/* Section content */}
      <div className="flex-1 min-w-0">
        {activeSection === "profile" && <ProfileSection />}
        {activeSection === "account" && <AccountSection />}
        {activeSection === "notifications" && <NotificationsSection />}
        {activeSection === "appearance" && <AppearanceSection />}
        {activeSection === "labels" && <LabelsSection />}
      </div>
    </div>
  );
}

export function SettingsView() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
