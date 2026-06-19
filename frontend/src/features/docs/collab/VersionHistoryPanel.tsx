"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  History,
  ChevronRight,
  RotateCcw,
  Loader2,
  Clock,
  User,
  FileText,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  usePageVersions,
  usePageVersion,
  useRestoreVersion,
  useSaveVersion,
} from "@/features/docs";
import type { PageVersionSummary } from "@/features/docs";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface VersionHistoryPanelProps {
  pageId: string;
  /** Called after a successful restore so the editor can react (e.g. reload). */
  onRestored?: () => void;
}

// ─── Version list item ─────────────────────────────────────────────────────────

interface VersionItemProps {
  version: PageVersionSummary;
  isSelected: boolean;
  onSelect: () => void;
}

function VersionItem({ version, isSelected, onSelect }: VersionItemProps) {
  const relativeTime = formatDistanceToNow(new Date(version.created_at), {
    addSuffix: true,
  });
  const absoluteTime = format(
    new Date(version.created_at),
    "MMM d, yyyy 'at' h:mm a",
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          isSelected
            ? "border-primary bg-primary/10"
            : "border-border bg-muted",
        )}
      >
        <Clock
          className={cn(
            "h-3.5 w-3.5",
            isSelected ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p
          className={cn(
            "font-medium leading-snug truncate",
            isSelected ? "text-foreground" : "text-foreground",
          )}
        >
          {version.title}
        </p>
        <p className="text-xs text-muted-foreground" title={absoluteTime}>
          {relativeTime}
        </p>
      </div>

      {isSelected && (
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Version preview ───────────────────────────────────────────────────────────

interface VersionPreviewProps {
  pageId: string;
  version: PageVersionSummary;
  onRestore: (versionId: string) => void;
  isRestoring: boolean;
}

function VersionPreview({
  pageId,
  version,
  onRestore,
  isRestoring,
}: VersionPreviewProps) {
  const { data: fullVersion, isLoading } = usePageVersion(pageId, version.id);

  const absoluteTime = format(
    new Date(version.created_at),
    "MMMM d, yyyy 'at' h:mm a",
  );

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="truncate font-semibold text-sm">{version.title}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{absoluteTime}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRestore(version.id)}
          disabled={isRestoring || isLoading}
          className="shrink-0 gap-1.5"
        >
          {isRestoring ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          Restore
        </Button>
      </div>

      <Separator />

      {/* Content preview */}
      <div className="min-h-[80px]">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading preview...
          </div>
        ) : fullVersion ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Content snapshot
            </p>
            <pre className="rounded bg-muted/50 p-2 text-xs text-foreground overflow-hidden max-h-40 whitespace-pre-wrap break-all">
              {JSON.stringify(fullVersion.content, null, 2).slice(0, 600)}
              {JSON.stringify(fullVersion.content).length > 600 ? "\n…" : ""}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Unable to load preview.
          </p>
        )}
      </div>

      {/* Restore notice */}
      <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Restoring will replace the current page content. The current state
          will be saved as a new version first.
        </p>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function VersionHistoryPanel({
  pageId,
  onRestored,
}: VersionHistoryPanelProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  const {
    data: versions,
    isLoading,
    isError,
  } = usePageVersions(pageId);

  const restoreVersion = useRestoreVersion(pageId);
  const saveVersion = useSaveVersion(pageId);

  const versionList = versions ?? [];
  const selectedVersion =
    versionList.find((v) => v.id === selectedVersionId) ?? null;

  function handleRestore(versionId: string) {
    restoreVersion.mutate(versionId, {
      onSuccess: () => {
        setSelectedVersionId(null);
        onRestored?.();
      },
    });
  }

  function handleSaveVersion() {
    saveVersion.mutate();
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <p>Failed to load version history.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {versionList.length} version{versionList.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSaveVersion}
          disabled={saveVersion.isPending}
          className="gap-1.5 text-xs"
        >
          {saveVersion.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <History className="h-3.5 w-3.5" />
          )}
          Save version
        </Button>
      </div>

      {/* Empty state */}
      {versionList.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          <History className="h-8 w-8 opacity-40" />
          <p className="font-medium">No versions yet</p>
          <p className="text-xs">
            Save a version manually or publish the page to create a snapshot.
          </p>
        </div>
      )}

      {/* List */}
      {versionList.length > 0 && (
        <ScrollArea className="max-h-72">
          <div className="flex flex-col gap-0.5 pr-2">
            {versionList.map((v, idx) => (
              <div key={v.id}>
                <VersionItem
                  version={v}
                  isSelected={selectedVersionId === v.id}
                  onSelect={() =>
                    setSelectedVersionId(
                      selectedVersionId === v.id ? null : v.id,
                    )
                  }
                />
                {idx < versionList.length - 1 && (
                  <div className="ml-[1.375rem] w-[1px] h-3 bg-border self-center" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Preview */}
      {selectedVersion && (
        <VersionPreview
          pageId={pageId}
          version={selectedVersion}
          onRestore={handleRestore}
          isRestoring={restoreVersion.isPending}
        />
      )}
    </div>
  );
}
