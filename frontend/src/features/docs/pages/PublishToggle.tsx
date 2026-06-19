"use client";

/**
 * PublishToggle — a toggle switch that controls whether a page is publicly
 * accessible at /p/<slug>.
 *
 * When enabled:
 * - Calls POST /api/pages/:id/public with { public: true }
 * - Backend mints a slug from the page title if none exists
 * - Shows the full public URL for copying
 *
 * When disabled:
 * - Calls POST /api/pages/:id/public with { public: false }
 * - Backend keeps the slug but marks is_public = false
 */

import * as React from "react";
import { Globe, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTogglePagePublic } from "@/features/docs";
import type { Page } from "@/types";

// ── Public URL helper ─────────────────────────────────────────────────────────

function getPublicUrl(slug: string): string {
  // In production this would be the app's origin; dev falls back to localhost.
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";
  return `${origin}/p/${slug}`;
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

function ToggleSwitch({ checked, disabled, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-primary" : "bg-input",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0",
          "transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PublishToggleProps {
  page: Page;
  className?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export function PublishToggle({ page, className }: PublishToggleProps) {
  const toggleMutation = useTogglePagePublic(page.id);
  const [copied, setCopied] = React.useState(false);

  const isPublic = page.is_public;
  const publicSlug = page.public_slug;
  const publicUrl = publicSlug ? getPublicUrl(publicSlug) : null;

  async function handleToggle(value: boolean) {
    try {
      await toggleMutation.mutateAsync({ public: value });
    } catch {
      // Error feedback handled by mutation error state
    }
  }

  async function handleCopy() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: silently fail
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Toggle row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Publish to web</p>
            <p className="text-xs text-muted-foreground">
              {isPublic
                ? "Anyone with the link can view this page."
                : "Only you can access this page."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {toggleMutation.isPending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          <ToggleSwitch
            checked={isPublic}
            disabled={toggleMutation.isPending}
            onChange={handleToggle}
            label={isPublic ? "Make private" : "Publish to web"}
          />
        </div>
      </div>

      {/* Error */}
      {toggleMutation.isError && (
        <p className="text-xs text-destructive">
          Failed to update publish state. Please try again.
        </p>
      )}

      {/* Public URL section — shown when published and slug exists */}
      {isPublic && publicUrl && (
        <div className="rounded-md border bg-muted/40 p-3 flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Public URL
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs font-mono border">
              {publicUrl}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy URL"}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              asChild
            >
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Pending: published but slug not yet propagated */}
      {isPublic && !publicUrl && !toggleMutation.isPending && (
        <p className="text-xs text-muted-foreground">
          Generating public URL…
        </p>
      )}
    </div>
  );
}
