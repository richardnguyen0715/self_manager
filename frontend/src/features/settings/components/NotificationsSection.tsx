"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { NotificationChannel } from "@/types";
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  useSubscribePush,
  useUnsubscribePush,
} from "../hooks/useNotificationPrefs";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

// ─── Channel toggle ────────────────────────────────────────────────────────────

const CHANNELS: { id: NotificationChannel; label: string; description: string }[] = [
  {
    id: "in_app",
    label: "In-app",
    description: "Bell icon in the sidebar",
  },
  {
    id: "browser_push",
    label: "Browser push",
    description: "Desktop / mobile notifications",
  },
];

interface ChannelPickerProps {
  label: string;
  description?: string;
  selected: NotificationChannel[];
  onChange: (channels: NotificationChannel[]) => void;
  disabled?: boolean;
}

function ChannelPicker({
  label,
  description,
  selected,
  onChange,
  disabled,
}: ChannelPickerProps) {
  const toggle = (ch: NotificationChannel) => {
    if (selected.includes(ch)) {
      onChange(selected.filter((c) => c !== ch));
    } else {
      onChange([...selected, ch]);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((ch) => {
          const active = selected.includes(ch.id);
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => toggle(ch.id)}
              disabled={disabled}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                disabled && "opacity-50 pointer-events-none",
              )}
              aria-pressed={active}
            >
              {ch.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Reminder offset picker ────────────────────────────────────────────────────

const OFFSET_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 1440, label: "1 day" },
  { minutes: 2880, label: "2 days" },
];

interface OffsetPickerProps {
  selected: number[];
  onChange: (offsets: number[]) => void;
  disabled?: boolean;
}

function OffsetPicker({ selected, onChange, disabled }: OffsetPickerProps) {
  const toggle = (minutes: number) => {
    if (selected.includes(minutes)) {
      onChange(selected.filter((m) => m !== minutes));
    } else {
      onChange([...selected, minutes].sort((a, b) => a - b));
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Deadline reminder lead times</p>
      <p className="text-xs text-muted-foreground">
        Receive reminders this far before a task or event deadline.
      </p>
      <div className="flex flex-wrap gap-2">
        {OFFSET_OPTIONS.map((opt) => {
          const active = selected.includes(opt.minutes);
          return (
            <button
              key={opt.minutes}
              type="button"
              onClick={() => toggle(opt.minutes)}
              disabled={disabled}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                disabled && "opacity-50 pointer-events-none",
              )}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Habit reminder time picker ────────────────────────────────────────────────

interface HabitReminderTimeProps {
  value: string | null;
  onChange: (time: string | null) => void;
  disabled?: boolean;
}

function HabitReminderTime({ value, onChange, disabled }: HabitReminderTimeProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Daily habit reminder time</p>
      <p className="text-xs text-muted-foreground">
        Send a daily reminder at this time to complete habits. Leave empty to
        disable.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="time"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={cn(
            "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function NotificationsSection() {
  const { data: prefs, isLoading, isError, error } = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const subscribePush = useSubscribePush();
  const unsubscribePush = useUnsubscribePush();

  const isMutating = update.isPending;

  const handleChannelChange = (
    field: "deadline_reminder_channels" | "habit_reminder_channels" | "time_block_reminder_channels",
    channels: NotificationChannel[],
  ) => {
    if (!prefs) return;
    update.mutate({ [field]: channels });
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
        Failed to load notification preferences: {error.message}
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div>
      <SettingsSectionHeader
        title="Notifications"
        description="Choose how and when you receive notifications."
      />

      <div className="space-y-6 max-w-lg w-full">
        {/* Deadline reminders */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h3 className="text-sm font-semibold">Deadline reminders</h3>

            <ChannelPicker
              label="Delivery channels"
              description="Where to send deadline reminders."
              selected={prefs.deadline_reminder_channels}
              onChange={(ch) =>
                handleChannelChange("deadline_reminder_channels", ch)
              }
              disabled={isMutating}
            />

            <Separator />

            <OffsetPicker
              selected={prefs.deadline_reminder_offsets}
              onChange={(offsets) =>
                update.mutate({ deadline_reminder_offsets: offsets })
              }
              disabled={isMutating}
            />
          </CardContent>
        </Card>

        {/* Habit reminders */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h3 className="text-sm font-semibold">Habit reminders</h3>

            <ChannelPicker
              label="Delivery channels"
              description="Where to send daily habit nudges."
              selected={prefs.habit_reminder_channels}
              onChange={(ch) =>
                handleChannelChange("habit_reminder_channels", ch)
              }
              disabled={isMutating}
            />

            <Separator />

            <HabitReminderTime
              value={prefs.habit_reminder_time}
              onChange={(time) =>
                update.mutate({ habit_reminder_time: time })
              }
              disabled={isMutating}
            />
          </CardContent>
        </Card>

        {/* Time block reminders */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <h3 className="text-sm font-semibold">Time-block reminders</h3>

            <ChannelPicker
              label="Delivery channels"
              description="Alert me when a time block is about to start."
              selected={prefs.time_block_reminder_channels}
              onChange={(ch) =>
                handleChannelChange("time_block_reminder_channels", ch)
              }
              disabled={isMutating}
            />
          </CardContent>
        </Card>

        {/* Push subscription */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Browser push subscription</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {prefs.browser_push_subscribed
                  ? "This device is subscribed to push notifications."
                  : "Subscribe this device to receive push notifications even when the tab is closed."}
              </p>
            </div>

            {prefs.browser_push_subscribed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unsubscribePush.mutate()}
                disabled={unsubscribePush.isPending}
              >
                {unsubscribePush.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                )}
                Unsubscribe this device
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => subscribePush.mutate()}
                disabled={subscribePush.isPending}
              >
                {subscribePush.isPending && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                )}
                Enable push notifications
              </Button>
            )}

            {subscribePush.isError && (
              <p className="text-xs text-destructive">
                {subscribePush.error.message}
              </p>
            )}
            {unsubscribePush.isError && (
              <p className="text-xs text-destructive">
                {unsubscribePush.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Save indicator */}
        {update.isError && (
          <p className="text-sm text-destructive">{update.error.message}</p>
        )}
        {update.isSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Preferences saved.
          </p>
        )}
      </div>
    </div>
  );
}
