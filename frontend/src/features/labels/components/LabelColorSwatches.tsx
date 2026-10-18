"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LABEL_COLOR_PRESETS } from "../types";

interface LabelColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

/** Row of preset colour swatches for picking a label colour. */
export function LabelColorSwatches({ value, onChange, className }: LabelColorSwatchesProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="radiogroup" aria-label="Label colour">
      {LABEL_COLOR_PRESETS.map((color) => {
        const selected = value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color}
            title={color}
            onClick={() => onChange(color)}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full ring-offset-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected && "ring-2 ring-ring ring-offset-1",
            )}
            style={{ backgroundColor: color }}
          >
            {selected && <Check className="h-3 w-3 text-white" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
