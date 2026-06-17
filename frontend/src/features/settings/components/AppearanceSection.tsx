"use client";

import React, { useEffect } from "react";
import { Check, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AppearancePreferences, ColorTheme } from "../types";
import {
  useAppearancePrefs,
  useUpdateAppearancePrefs,
} from "../hooks/useAppearancePrefs";
import { useAppearanceStore } from "../settings.store";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

// ─── Theme selector ────────────────────────────────────────────────────────────

const THEME_OPTIONS: {
  id: AppearancePreferences["theme"];
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

// ─── Color themes ──────────────────────────────────────────────────────────────

const COLOR_THEMES: { id: ColorTheme; label: string; swatch: string }[] = [
  { id: "zinc", label: "Zinc", swatch: "bg-zinc-500" },
  { id: "slate", label: "Slate", swatch: "bg-slate-500" },
  { id: "blue", label: "Blue", swatch: "bg-blue-500" },
  { id: "green", label: "Green", swatch: "bg-green-500" },
  { id: "rose", label: "Rose", swatch: "bg-rose-500" },
  { id: "orange", label: "Orange", swatch: "bg-orange-500" },
];

// ─── Toggle row ────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {/* Accessible toggle switch */}
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

// ─── Week start picker ────────────────────────────────────────────────────────

interface WeekStartPickerProps {
  value: 0 | 1;
  onChange: (day: 0 | 1) => void;
  disabled?: boolean;
}

function WeekStartPicker({ value, onChange, disabled }: WeekStartPickerProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Week starts on</Label>
      <div className="flex gap-2">
        {([0, 1] as const).map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            disabled={disabled}
            className={cn(
              "flex-1 rounded-md border py-1.5 text-sm font-medium transition-colors",
              value === day
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground",
              disabled && "opacity-50 pointer-events-none",
            )}
          >
            {day === 0 ? "Sunday" : "Monday"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Theme effect ──────────────────────────────────────────────────────────────

/**
 * Applies the chosen theme to the <html> element so Tailwind's dark mode
 * class strategy picks it up without a full page reload.
 */
function useThemeEffect() {
  const theme = useAppearanceStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(prefersDark ? "dark" : "light");
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function AppearanceSection() {
  const { isLoading, isError, error } = useAppearancePrefs();
  const update = useUpdateAppearancePrefs();

  // Local store (synced from server by useAppearancePrefs)
  const theme = useAppearanceStore((s) => s.theme);
  const colorTheme = useAppearanceStore((s) => s.colorTheme);
  const compactMode = useAppearanceStore((s) => s.compactMode);
  const showCompletedTasks = useAppearanceStore((s) => s.showCompletedTasks);
  const weekStartsOn = useAppearanceStore((s) => s.weekStartsOn);

  useThemeEffect();

  const mutate = (payload: Parameters<typeof update.mutate>[0]) => {
    update.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Failed to load appearance settings: {error.message}
      </div>
    );
  }

  const disabled = update.isPending;

  return (
    <div>
      <SettingsSectionHeader
        title="Appearance"
        description="Customize the look and feel of the app."
      />

      <div className="space-y-6 max-w-lg">
        {/* Color scheme */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h3 className="text-sm font-semibold">Color scheme</h3>

            {/* Light / Dark / System */}
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => mutate({ theme: opt.id })}
                    disabled={disabled}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 py-4 px-2 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-accent text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                      disabled && "opacity-50 pointer-events-none",
                    )}
                    aria-pressed={active}
                  >
                    <Icon className="h-5 w-5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Color theme */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Accent color</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_THEMES.map((ct) => {
                  const active = colorTheme === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => mutate({ color_theme: ct.id })}
                      disabled={disabled}
                      title={ct.label}
                      className={cn(
                        "relative h-8 w-8 rounded-full transition-transform",
                        ct.swatch,
                        active && "ring-2 ring-offset-2 ring-foreground scale-110",
                        disabled && "opacity-50 pointer-events-none",
                      )}
                      aria-label={ct.label}
                      aria-pressed={active}
                    >
                      {active && (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Layout preferences */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h3 className="text-sm font-semibold">Layout</h3>

            <ToggleRow
              id="compact-mode"
              label="Compact mode"
              description="Reduce spacing to show more content at once."
              checked={compactMode}
              onCheckedChange={(v) => mutate({ compact_mode: v })}
              disabled={disabled}
            />

            <ToggleRow
              id="show-completed"
              label="Show completed tasks"
              description="Include completed tasks in task list views."
              checked={showCompletedTasks}
              onCheckedChange={(v) => mutate({ show_completed_tasks: v })}
              disabled={disabled}
            />

            <WeekStartPicker
              value={weekStartsOn}
              onChange={(day) => mutate({ week_starts_on: day })}
              disabled={disabled}
            />
          </CardContent>
        </Card>

        {/* Status messages */}
        {update.isError && (
          <p className="text-sm text-destructive">{update.error.message}</p>
        )}
        {update.isSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Appearance preferences saved.
          </p>
        )}
      </div>
    </div>
  );
}
