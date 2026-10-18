"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { format } from "date-fns";
import { useSnoozeNotification } from "../hooks/useNotifications";

interface SnoozeMenuProps {
  notificationId: string;
  /** "snooze" offers the snooze presets; "unsnooze" offers a single restore action. */
  mode?: "snooze" | "unsnooze";
}

const HOUR_MS = 60 * 60 * 1000;

/** Tomorrow at 09:00 local time. */
function tomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Next Monday at 09:00 local time (always a future day, never today). */
function nextWeekAt9(): Date {
  const d = new Date();
  const daysUntilMonday = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

function menuItemClass() {
  return "w-full rounded-sm px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:bg-muted disabled:opacity-50";
}

export function SnoozeMenu({ notificationId, mode = "snooze" }: SnoozeMenuProps) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const { mutate, isPending, error } = useSnoozeNotification();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const customUntil = customDate ? new Date(`${customDate}T09:00:00`) : null;
  const customValid = Boolean(customUntil && customUntil.getTime() > Date.now());

  // Close on outside click or Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
      setShowCustom(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function applyUntil(until: Date | null) {
    mutate(
      { id: notificationId, until },
      {
        onSuccess: () => {
          setOpen(false);
          setShowCustom(false);
          setCustomDate("");
        },
      },
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
      >
        <Clock className="h-3 w-3" />
        {mode === "unsnooze" ? "Unsnooze" : "Snooze"}
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Snooze options"
          className="absolute right-0 z-20 mt-1 w-56 rounded-md border bg-popover p-1 shadow-md"
        >
          {mode === "unsnooze" ? (
            <button
              type="button"
              role="menuitem"
              className={menuItemClass()}
              disabled={isPending}
              onClick={() => applyUntil(null)}
            >
              Return to inbox now
            </button>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className={menuItemClass()}
                disabled={isPending}
                onClick={() => applyUntil(new Date(Date.now() + HOUR_MS))}
              >
                1 hour
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuItemClass()}
                disabled={isPending}
                onClick={() => applyUntil(tomorrowAt9())}
              >
                Tomorrow, 9:00 AM
              </button>
              <button
                type="button"
                role="menuitem"
                className={menuItemClass()}
                disabled={isPending}
                onClick={() => applyUntil(nextWeekAt9())}
              >
                Next week, Monday 9:00 AM
              </button>

              {!showCustom ? (
                <button
                  type="button"
                  role="menuitem"
                  className={menuItemClass()}
                  onClick={() => setShowCustom(true)}
                >
                  Custom date&hellip;
                </button>
              ) : (
                <div className="space-y-2 p-2">
                  <DateInput
                    value={customDate}
                    onChange={setCustomDate}
                    min={todayStr}
                    placeholder="Pick a date"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Returns at 9:00 AM on the chosen day.
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!customValid || isPending}
                    onClick={() => customUntil && applyUntil(customUntil)}
                  >
                    Snooze until date
                  </Button>
                </div>
              )}
            </>
          )}

          {error && (
            <p role="alert" className="px-2 py-1 text-[11px] text-destructive">
              {error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
