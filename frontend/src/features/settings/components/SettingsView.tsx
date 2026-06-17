"use client";

import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { useSettingsUIStore } from "../settings.store";
import { SettingsSidebar } from "./SettingsSidebar";
import { ProfileSection } from "./ProfileSection";
import { AccountSection } from "./AccountSection";
import { NotificationsSection } from "./NotificationsSection";
import { AppearanceSection } from "./AppearanceSection";

function SettingsContent() {
  const activeSection = useSettingsUIStore((s) => s.activeSection);

  return (
    <div className="flex gap-8 min-h-full">
      <SettingsSidebar />

      {/* Vertical divider */}
      <div className="w-px bg-border shrink-0" aria-hidden="true" />

      {/* Section content */}
      <div className="flex-1 min-w-0">
        {activeSection === "profile" && <ProfileSection />}
        {activeSection === "account" && <AccountSection />}
        {activeSection === "notifications" && <NotificationsSection />}
        {activeSection === "appearance" && <AppearanceSection />}
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
