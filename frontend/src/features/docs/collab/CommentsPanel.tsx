"use client";

import { useState, useRef, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  usePageComments,
  useCreateComment,
  useDeleteComment,
} from "@/features/docs";
import type { PageComment } from "@/features/docs";
import { useAuthStore } from "@/stores";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CommentsPanelProps {
  pageId: string;
}

// ─── Single comment ────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: PageComment;
  currentUserId: string | undefined;
  onDelete: (commentId: string) => void;
  isDeleting: boolean;
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
  isDeleting,
}: CommentItemProps) {
  const isOwn = currentUserId === comment.user_id;
  const relativeTime = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
  });
  const absoluteTime = format(
    new Date(comment.created_at),
    "MMM d, yyyy 'at' h:mm a",
  );

  return (
    <div className="group relative flex gap-3 py-3">
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted border">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 space-y-1">
        {/* Byline */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {isOwn ? "You" : "Team member"}
          </span>
          <span
            className="text-xs text-muted-foreground"
            title={absoluteTime}
          >
            {relativeTime}
          </span>
        </div>

        {/* Text */}
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      </div>

      {/* Delete (own comments only) */}
      {isOwn && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "absolute right-0 top-2.5 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100",
            isDeleting && "opacity-100",
          )}
          onClick={() => onDelete(comment.id)}
          disabled={isDeleting}
          aria-label="Delete comment"
        >
          {isDeleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Compose box ───────────────────────────────────────────────────────────────

interface ComposeBoxProps {
  onSubmit: (body: string) => void;
  isPending: boolean;
}

function ComposeBox({ onSubmit, isPending }: ComposeBoxProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [body]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || isPending) return;
    onSubmit(trimmed);
    setBody("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment… (Cmd+Enter to submit)"
        rows={2}
        className={cn(
          "w-full resize-none bg-transparent text-sm text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none",
          "min-h-[3rem] max-h-40",
        )}
        disabled={isPending}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {body.length > 0 && `${body.length} / 10000`}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || isPending || body.length > 10000}
          className="gap-1.5"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Comment
        </Button>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export function CommentsPanel({ pageId }: CommentsPanelProps) {
  const { user } = useAuthStore();

  const {
    data: comments,
    isLoading,
    isError,
  } = usePageComments(pageId);

  const createComment = useCreateComment(pageId);
  const deleteComment = useDeleteComment(pageId);

  // Track which comment ID is being deleted for per-item spinner
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const commentList = comments ?? [];

  function handleCreate(body: string) {
    createComment.mutate({ body });
  }

  function handleDelete(commentId: string) {
    setDeletingId(commentId);
    deleteComment.mutate(commentId, {
      onSettled: () => setDeletingId(null),
    });
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
        <p>Failed to load comments.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header count */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {commentList.length} comment{commentList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Compose */}
      <ComposeBox
        onSubmit={handleCreate}
        isPending={createComment.isPending}
      />

      {/* Error on submit */}
      {createComment.isError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Failed to post comment. Please try again.
        </div>
      )}

      {/* Empty state */}
      {commentList.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          <MessageSquare className="h-7 w-7 opacity-40" />
          <p className="font-medium">No comments yet</p>
          <p className="text-xs">
            Be the first to leave a comment on this page.
          </p>
        </div>
      )}

      {/* Comment list */}
      {commentList.length > 0 && (
        <ScrollArea className="max-h-96">
          <div className="flex flex-col divide-y divide-border pr-2">
            {commentList.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                onDelete={handleDelete}
                isDeleting={deletingId === comment.id}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
