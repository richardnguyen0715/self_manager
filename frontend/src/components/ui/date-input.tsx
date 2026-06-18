"use client";

import { format } from "date-fns";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateInputProps {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  min?: string;
  max?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DateInput({
  value,
  onChange,
  id,
  min,
  max,
  className,
  placeholder,
  disabled,
}: DateInputProps) {
  function handleSetToday() {
    onChange(format(new Date(), "yyyy-MM-dd"));
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
      <button
        type="button"
        onClick={handleSetToday}
        disabled={disabled}
        aria-label="Set to today"
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-transparent shadow-sm",
          "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <CalendarCheck className="h-4 w-4" />
      </button>
    </div>
  );
}
