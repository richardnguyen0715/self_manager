"use client";

import { useEffect, useRef } from "react";

interface EmojiPickerProps {
  emojis: string[];
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ emojis, onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-50 mt-1 grid grid-cols-8 gap-0.5 rounded-lg border bg-popover p-2 shadow-lg"
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-accent transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
