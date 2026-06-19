"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Globe,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { usePage, useSpace } from "@/features/docs";
import { DocView } from "@/features/docs/editor/DocEditor";
import { Whiteboard } from "@/features/docs/whiteboard/Whiteboard";

interface DocsPublishedPageProps {
  spaceId: string;
  pageId: string;
}

export function DocsPublishedPage({ spaceId, pageId }: DocsPublishedPageProps) {
  const router = useRouter();
  const { data: page, isLoading, isError } = usePage(pageId);
  const { data: space } = useSpace(spaceId);

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

  // ── Draft guard: redirect to editor if not published ──────────────────────
  if (page.status !== "published") {
    return (
      <div className="flex h-[calc(100vh-9rem)] flex-col items-center justify-center gap-3 text-center">
        <Globe className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">This page hasn&apos;t been published yet.</p>
        <p className="text-sm text-muted-foreground">
          Publish it to make a public read-only version available.
        </p>
        <Button
          size="sm"
          onClick={() => router.push(`/docs/${spaceId}/${pageId}`)}
        >
          <Edit className="h-4 w-4" />
          Open Editor
        </Button>
      </div>
    );
  }

  const isWhiteboard = page.kind === "whiteboard";

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden rounded-lg border">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        {/* Breadcrumb */}
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link href={`/docs/${spaceId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        {space && (
          <>
            <Link
              href={`/docs/${spaceId}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {space.icon && <span className="mr-1">{space.icon}</span>}
              {space.name}
            </Link>
            <span className="text-muted-foreground">/</span>
          </>
        )}

        <span className="truncate text-sm font-medium">
          {page.title || "Untitled"}
        </span>

        <Separator orientation="vertical" className="h-5" />

        <Badge variant="default" className="shrink-0 text-xs">
          Published
        </Badge>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Edit button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/docs/${spaceId}/${pageId}`)}
          className="gap-1.5"
        >
          <Edit className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {isWhiteboard ? (
          <Whiteboard pageId={pageId} readOnly={true} />
        ) : (
          <div className="mx-auto max-w-3xl px-8 py-10">
            {/* Page header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                {page.title || "Untitled"}
              </h1>
              {page.published_at && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Published on{" "}
                  {new Date(page.published_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>

            <Separator className="mb-8" />

            {/* Read-only TipTap render — DocView only needs the content JSON */}
            <DocView content={page.content ?? {}} />
          </div>
        )}
      </div>
    </div>
  );
}
