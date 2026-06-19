"use client";

import * as React from "react";
import { Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Emoji categories ──────────────────────────────────────────────────────────

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇",
      "🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚",
      "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "📄","📃","📑","📊","📈","📉","📋","📁","📂","🗂",
      "🗒","🗓","📆","📅","📇","📌","📍","📎","🖇","✂",
      "🖊","🖋","✒","🖌","🖍","📝","✏","🔍","🔎","🔏",
      "🔐","🔑","🗝","🔨","⚙","🔧","🔩","🗜","⚖","🔗",
    ],
  },
  {
    label: "Symbols",
    emojis: [
      "⭐","🌟","💫","✨","🔥","💥","❄","🌈","☀","🌤",
      "⛅","🌥","☁","🌦","🌧","⛈","🌩","🌨","🌪","🌫",
      "🌊","💧","💦","☔","⚡","❤","🧡","💛","💚","💙",
      "💜","🖤","🤍","🤎","💔","❣","💕","💞","💓","💗",
    ],
  },
  {
    label: "Nature",
    emojis: [
      "🌱","🌿","🍀","🌾","🍃","🌳","🌴","🌵","🌲","🎋",
      "🎍","🍄","🌸","🌺","🌻","🌼","🌷","🌹","🥀","💐",
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
    ],
  },
  {
    label: "Food",
    emojis: [
      "🍎","🍊","🍋","🍇","🍓","🍒","🍑","🥭","🍍","🥝",
      "🍅","🥑","🥦","🥕","🌽","🥑","🍕","🍔","🌮","🌯",
      "🍜","🍝","🍛","🍣","🍱","🍤","🍙","🍚","🍘","🍢",
    ],
  },
  {
    label: "Activities",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🥏","🎱",
      "🏓","🏸","🏒","🎯","🎳","⛳","🎣","🎽","🎿","🛷",
      "🏆","🥇","🥈","🥉","🎖","🏅","🎗","🎫","🎟","🎪",
    ],
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PageIconPickerProps {
  /** Current emoji or null. */
  value: string | null;
  /** Called when user picks or clears an emoji. */
  onChange: (emoji: string | null) => void;
  /** Additional wrapper class. */
  className?: string;
  /** Disabled state. */
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageIconPicker({
  value,
  onChange,
  className,
  disabled = false,
}: PageIconPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [activeGroup, setActiveGroup] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(emoji: string) {
    onChange(emoji);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        className={cn(
          "group relative flex h-12 w-12 items-center justify-center rounded-xl text-3xl",
          "transition-colors hover:bg-muted/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label={value ? `Change icon (${value})` : "Add icon"}
        title={value ? "Change icon" : "Add page icon"}
      >
        {value ? (
          <>
            <span className="leading-none">{value}</span>
            {/* Clear badge on hover */}
            <span
              onClick={handleClear}
              className="absolute -right-1 -top-1 hidden h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-muted-foreground/70 text-white group-hover:flex"
              title="Remove icon"
            >
              <X className="h-2.5 w-2.5" />
            </span>
          </>
        ) : (
          <Smile className="h-7 w-7 text-muted-foreground/40 group-hover:text-muted-foreground" />
        )}
      </button>

      {/* Picker panel */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border bg-popover shadow-xl">
          {/* Category tabs */}
          <div className="flex gap-0.5 border-b px-2 pt-2 overflow-x-auto scrollbar-none">
            {EMOJI_GROUPS.map((group, i) => (
              <button
                key={group.label}
                type="button"
                onClick={() => setActiveGroup(i)}
                className={cn(
                  "shrink-0 rounded-t-md px-2 py-1 text-xs font-medium transition-colors",
                  activeGroup === i
                    ? "bg-background text-foreground border border-b-0 border-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {group.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto">
            {EMOJI_GROUPS[activeGroup]?.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelect(emoji)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md text-lg",
                  "transition-colors hover:bg-accent",
                  value === emoji && "bg-primary/10 ring-1 ring-primary",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Clear / remove option */}
          {value && (
            <div className="border-t p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground justify-start gap-1.5"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="h-3 w-3" />
                Remove icon
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
