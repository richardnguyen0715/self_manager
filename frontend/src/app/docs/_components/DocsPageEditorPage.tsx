"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Clock,
  Edit,
  MessageSquare,
  History,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  usePage,
  useUpdatePage,
  usePublishPage,
  useDeletePage,
} from "@/features/docs";
import { DocEditor } from "@/features/docs/editor/DocEditor";
import { Whiteboard } from "@/features/docs/whiteboard/Whiteboard";
import { VersionHistoryPanel } from "@/features/docs/collab/VersionHistoryPanel";
import { CommentsPanel } from "@/features/docs/collab/CommentsPanel";

// ─── Right panel tabs ─────────────────────────────────────────────────────────

type RightPanel = "comments" | "history" | null;

// ─── Save-status indicator ────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return <span className="text-xs text-muted-foreground">Saved</span>;
  }
  return <span className="text-xs text-destructive">Save failed</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DocsPageEditorPageProps {
  spaceId: string;
  pageId: string;
}

export function DocsPageEditorPage({
  spaceId,
  pageId,
}: DocsPageEditorPageProps) {
  const router = useRouter();

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: page, isLoading, isError } = usePage(pageId);
  const updatePage = useUpdatePage(pageId);
  const publishPage = usePublishPage();
  const deletePage = useDeletePage();

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [publishPending, setPublishPending] = useState(false);

  // Debounce title save
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Title change (debounced 600 ms) ────────────────────────────────────────
  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setTitleDraft(value);
    setSaveStatus("idle");

    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      setSaveStatus("saving");
      updatePage.mutate(
        { title: value },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
          },
          onError: () => setSaveStatus("error"),
        },
      );
    }, 600);
  }

  // ── Content change (wired from DocEditor via onChange) ────────────────────
  const handleContentChange = useCallback(
    (doc: Record<string, unknown>) => {
      setSaveStatus("saving");
      updatePage.mutate(
        { content: doc },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            setTimeout(() => setSaveStatus("idle"), 2000);
          },
          onError: () => setSaveStatus("error"),
        },
      );
    },
    [updatePage],
  );

  // ── Publish ────────────────────────────────────────────────────────────────
  function handlePublish() {
    setPublishPending(true);
    publishPage.mutate(pageId, {
      onSuccess: () => setPublishPending(false),
      onError: () => setPublishPending(false),
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!page) return;
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    deletePage.mutate(
      { id: pageId, spaceId },
      { onSuccess: () => router.push(`/docs/${spaceId}`) },
    );
  }

  // ── Panel toggle ───────────────────────────────────────────────────────────
  function togglePanel(panel: RightPanel) {
    setRightPanel((current) => (current === panel ? null : panel));
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-9rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error / not found ──────────────────────────────────────────────────────
  if (isError || !page) {
    return (
      <div className="flex h-[calc(100vh-9rem)] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Page not found or you don&apos;t have access.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/docs/${spaceId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Space
          </Link>
        </Button>
      </div>
    );
  }

  const title = titleDraft ?? page.title;
  const isPublished = page.status === "published";
  const isWhiteboard = page.kind === "whiteboard";

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-lg border">
      {/* ── Toolbar bar ─────────────────────────────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        {/* Back */}
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link href={`/docs/${spaceId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <Separator orientation="vertical" className="h-5" />

        {/* Status badge */}
        <Badge
          variant={isPublished ? "default" : "secondary"}
          className="shrink-0 text-xs capitalize"
        >
          {page.status}
        </Badge>

        {/* Save indicator */}
        <SaveIndicator status={saveStatus} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        {isPublished ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <Link href={`/docs/${spaceId}/${pageId}/published`}>
              <Globe className="h-3.5 w-3.5" />
              View Published
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishPending}
            className="gap-1.5"
          >
            {publishPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            Publish
          </Button>
        )}

        {/* Panel toggles */}
        <Separator orientation="vertical" className="h-5" />

        <Button
          size="icon"
          variant={rightPanel === "comments" ? "secondary" : "ghost"}
          className="h-8 w-8"
          onClick={() => togglePanel("comments")}
          title="Comments"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          variant={rightPanel === "history" ? "secondary" : "ghost"}
          className="h-8 w-8"
          onClick={() => togglePanel("history")}
          title="Version history"
        >
          <History className="h-4 w-4" />
        </Button>

        {/* Delete */}
        <Separator orientation="vertical" className="h-5" />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={deletePage.isPending}
          title="Delete page"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Body: editor + optional right panel ─────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor / whiteboard column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Title input — only for page kind */}
          {!isWhiteboard && (
            <div className="border-b px-8 py-4">
              <input
                className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                placeholder="Untitled"
                value={title}
                onChange={handleTitleChange}
                maxLength={500}
                aria-label="Page title"
              />
              {/* Author / date line */}
              <p className="mt-1 text-xs text-muted-foreground">
                {page.published_at
                  ? `Published ${new Date(page.published_at).toLocaleDateString()}`
                  : `Last updated ${new Date(page.updated_at).toLocaleDateString()}`}
              </p>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-auto">
            {isWhiteboard ? (
              <Whiteboard pageId={pageId} readOnly={false} />
            ) : (
              <div className="mx-auto max-w-3xl px-8 py-6">
                {/* Published view shows read-only + edit button */}
                {isPublished ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Published{" "}
                        {page.published_at
                          ? new Date(page.published_at).toLocaleDateString()
                          : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/docs/${spaceId}/${pageId}/published`,
                          )
                        }
                        className="gap-1.5"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        View published page
                      </Button>
                    </div>
                    <DocEditor
                      pageId={pageId}
                      value={page.content ?? {}}
                      onChange={handleContentChange}
                      showTemplatePicker={false}
                    />
                  </div>
                ) : (
                  <DocEditor
                    pageId={pageId}
                    value={page.content ?? {}}
                    onChange={handleContentChange}
                    showTemplatePicker={
                      !page.content || Object.keys(page.content).length === 0
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────────────── */}
        {rightPanel !== null && (
          <>
            <Separator orientation="vertical" />
            <aside className="flex w-80 shrink-0 flex-col overflow-hidden">
              {/* Panel header */}
              <div className="flex h-10 items-center justify-between border-b px-4">
                <span className="text-sm font-medium">
                  {rightPanel === "comments" ? "Comments" : "Version History"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setRightPanel(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-auto p-4">
                {rightPanel === "comments" ? (
                  <CommentsPanel pageId={pageId} />
                ) : (
                  <VersionHistoryPanel
                    pageId={pageId}
                    onRestored={() => {
                      // Page data will auto-refresh via query invalidation
                    }}
                  />
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
