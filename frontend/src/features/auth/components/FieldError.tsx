import React from "react";
import { cn } from "@/lib/utils";

interface FieldErrorProps {
  message?: string;
  className?: string;
}

/** Inline validation error shown beneath a form field. */
export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("mt-1 text-xs text-destructive", className)}>
      {message}
    </p>
  );
}
