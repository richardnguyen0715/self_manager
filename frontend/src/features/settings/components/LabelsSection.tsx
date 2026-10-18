"use client";

import { LabelsManager } from "@/features/labels";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

export function LabelsSection() {
  return (
    <div className="max-w-2xl">
      <SettingsSectionHeader
        title="Labels"
        description="Create, rename, recolour and delete the labels used on work items."
      />
      <LabelsManager />
    </div>
  );
}
