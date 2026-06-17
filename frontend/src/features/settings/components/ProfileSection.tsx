"use client";

import React, { useRef, useState } from "react";
import { Camera, Loader2, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useProfile, useUpdateProfile, useUploadAvatar, useRemoveAvatar } from "../hooks/useProfile";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

// ─── Timezone options (IANA subset) ───────────────────────────────────────────

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Europe/Kyiv",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

export function ProfileSection() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Populate form once profile loads
  React.useEffect(() => {
    if (profile && !isDirty) {
      setName(profile.display_name);
      setTimezone(profile.timezone);
    }
  }, [profile, isDirty]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsDirty(true);
  };

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimezone(e.target.value);
    setIsDirty(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile.mutateAsync({
      name: name.trim(),
      timezone,
    });
    setIsDirty(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatar.mutate(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const avatarUrl = profile?.avatar_url;
  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <SettingsSectionHeader
        title="Profile"
        description="Update your display name, avatar, and timezone."
      />

      <div className="space-y-8 max-w-lg">
        {/* Avatar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              {/* Avatar preview */}
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.display_name ?? "Avatar"}
                    className="h-20 w-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <span className="text-2xl font-semibold text-muted-foreground">
                      {initials}
                    </span>
                  </div>
                )}

                {(uploadAvatar.isPending) && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Profile photo</p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WebP. Max 5 MB.
                </p>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAvatar.isPending}
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    {avatarUrl ? "Change" : "Upload"}
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeAvatar.mutate()}
                      disabled={removeAvatar.isPending}
                    >
                      {removeAvatar.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove
                    </Button>
                  )}
                </div>
                {uploadAvatar.isError && (
                  <p className="text-xs text-destructive mt-1">
                    {uploadAvatar.error.message}
                  </p>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Profile form */}
        <form onSubmit={handleSave} className="space-y-5">
          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile?.email ?? ""}
              readOnly
              disabled
              className="bg-muted/50 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed via settings.
            </p>
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Your name"
              maxLength={80}
              required
            />
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={handleTimezoneChange}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1",
                "text-sm shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Used for due-date reminders and day-boundary calculations.
            </p>
          </div>

          {/* Error */}
          {updateProfile.isError && (
            <p className="text-sm text-destructive">
              {updateProfile.error.message}
            </p>
          )}

          {/* Success */}
          {updateProfile.isSuccess && !isDirty && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Profile updated successfully.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isDirty || updateProfile.isPending}
            >
              {updateProfile.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
