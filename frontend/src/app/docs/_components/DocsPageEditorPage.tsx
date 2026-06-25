"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Globe,
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
  useUnpublishPage,
  useDeletePage,
} from "@/features/docs";
import { DocEditor } from "@/features/docs/editor/DocEditor";
import { Whiteboard } from "@/features/docs/whiteboard/Whiteboard";
import { VersionHistoryPanel } from "@/features/docs/collab/VersionHistoryPanel";
import { CommentsPanel } from "@/features/docs/collab/CommentsPanel";
import { PageMetaHeader } from "@/features/docs/pages/PageMetaHeader";
import { PageTemplatesPicker } from "@/features/docs/pages/PageTemplatesPicker";
import { PagePeekPanel } from "@/features/docs/PagePeekPanel";
import type { TipTapDoc } from "@/types";
import { useConfirm } from "@/components/ui/confirm-dialog";

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
  const confirm = useConfirm();

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: page, isLoading, isError } = usePage(pageId);
  const updatePage = useUpdatePage(pageId);
  const publishPage = usePublishPage();
  const unpublishPage = useUnpublishPage();
  const deletePage = useDeletePage();

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [publishPending, setPublishPending] = useState(false);

  // Templates picker — only on brand-new blank pages.
  // `templatesDismissed` tracks whether the user has already closed it once
  // so we don't re-open on every render.
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatesDismissed, setTemplatesDismissed] = useState(false);

  // Ref for the editor content value to pass to DocEditor
  const [editorContent, setEditorContent] = useState<TipTapDoc | null>(null);

  // Debounce timers
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Content change (debounced 800 ms) ─────────────────────────────────────
  const handleContentChange = useCallback(
    (doc: TipTapDoc) => {
      setEditorContent(doc);
      setSaveStatus("idle");

      if (contentTimer.current) clearTimeout(contentTimer.current);
      contentTimer.current = setTimeout(() => {
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
      }, 800);
    },
    [updatePage],
  );

  // ── Template select (local content) ───────────────────────────────────────
  function handleTemplateSelectContent(content: TipTapDoc) {
    setEditorContent(content);
    updatePage.mutate({ content });
  }

  // ── Template select (server-created page) ─────────────────────────────────
  function handleTemplateSelectFromServer(newPage: { id: string }) {
    router.push(`/docs/${spaceId}/${newPage.id}`);
  }

  // ── Publish (internal draft → published status) ────────────────────────────
  function handlePublish() {
    setPublishPending(true);
    publishPage.mutate(pageId, {
      onSuccess: () => setPublishPending(false),
      onError: () => setPublishPending(false),
    });
  }

  function handleUnpublish() {
    setPublishPending(true);
    unpublishPage.mutate(pageId, {
      onSuccess: () => setPublishPending(false),
      onError: () => setPublishPending(false),
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!page) return;
    if (
      !(await confirm({
        title: `Delete "${page.title}"?`,
        description: "This cannot be undone.",
        confirmText: "Delete",
        destructive: true,
      }))
    )
      return;
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

  // The content shown to DocEditor — prefer local editorContent for freshly
  // applied templates, otherwise fall back to persisted page content.
  const docContent = editorContent ?? (page.content ?? {});

  // Show templates picker when page is blank (no content at all) and not yet dismissed
  const isBlankPage =
    !isWhiteboard &&
    !page.content &&
    !editorContent &&
    !templatesDismissed;

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

        {/* Public badge */}
        {page.is_public && (
          <Badge
            variant="outline"
            className="shrink-0 text-xs gap-1 border-green-400 text-green-600"
          >
            <Globe className="h-3 w-3" />
            Public
          </Badge>
        )}

        {/* Save indicator */}
        <SaveIndicator status={saveStatus} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Publish / Unpublish (internal draft ↔ published status) */}
        {!isPublished ? (
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
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleUnpublish}
            disabled={publishPending}
            className="gap-1.5"
          >
            {publishPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            Unpublish
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
          <div className="flex-1 overflow-auto">
            {isWhiteboard ? (
              <Whiteboard pageId={pageId} readOnly={false} />
            ) : (
              <div className="mx-auto w-full max-w-none">
                {/* V2 page meta header: cover + icon + title + meta actions */}
                <PageMetaHeader
                  page={page}
                  spaceId={spaceId}
                  onTitleChange={handleTitleChange}
                  titleValue={title}
                  readOnly={false}
                />

                {/* Editor body */}
                <div className="px-8 py-4">
                  <DocEditor
                    pageId={pageId}
                    spaceId={spaceId}
                    value={docContent}
                    onChange={handleContentChange}
                    showTemplatePicker={isBlankPage}
                  />
                </div>
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

      {/* Templates picker — shown when user explicitly triggers or page is blank */}
      <PageTemplatesPicker
        open={templatePickerOpen || isBlankPage}
        onClose={() => {
          setTemplatePickerOpen(false);
          setTemplatesDismissed(true);
        }}
        spaceId={spaceId}
        parentId={page.parent_id ?? undefined}
        onSelectContent={handleTemplateSelectContent}
        onSelectFromServer={handleTemplateSelectFromServer}
      />

      {/* Page peek panel — slides in from the right when a @mention chip is clicked */}
      <PagePeekPanel />
    </div>
  );
}
