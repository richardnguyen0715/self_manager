"use client";

import { Separator } from "@/components/ui/separator";

interface SettingsSectionHeaderProps {
  title: string;
  description?: string;
}

export function SettingsSectionHeader({
  title,
  description,
}: SettingsSectionHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
      <Separator className="mt-4" />
    </div>
  );
}
