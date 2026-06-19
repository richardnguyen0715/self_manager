"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Calendar } from "lucide-react";
import { DocView } from "@/features/docs/editor/DocEditor";
import { PublicPageSidebar } from "./PublicPageSidebar";
import type { PublicPage } from "@/types";

// ─── Public Chrome Header ─────────────────────────────────────────────────────

function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          ManageMyLife
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          Public page
        </span>
      </div>
    </header>
  );
}

// ─── Cover image ─────────────────────────────────────────────────────────────

function CoverImage({ url }: { url: string }) {
  const isExternal = url.startsWith("http");
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const src = isExternal ? url : `${API_BASE}${url}`;

  return (
    <div className="relative h-52 w-full overflow-hidden sm:h-64">
      <Image
        src={src}
        alt="Page cover"
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
    </div>
  );
}

// ─── Page icon ────────────────────────────────────────────────────────────────

function PageIconDisplay({ icon }: { icon: string }) {
  return (
    <div className="text-5xl leading-none" aria-hidden>
      {icon}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PublicPageViewProps {
  page: PublicPage;
  slug: string;
  /** The root slug (top-most public ancestor) used for sidebar tree fetch.
   *  For MVP we use the current slug as root. */
  rootSlug: string;
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PublicPageView({ page, slug, rootSlug }: PublicPageViewProps) {
  const hasCover = Boolean(page.cover_url);
  const hasIcon = Boolean(page.icon);
  const children = page.children ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <div className="flex flex-1">
        {/* Sidebar — only shown when there are navigable children or a tree */}
        {children.length > 0 && (
          <aside className="hidden border-r lg:block">
            <div className="sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto px-3">
              <PublicPageSidebar
                rootSlug={rootSlug}
                activeSlug={slug}
                directChildren={children}
              />
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {/* Cover */}
          {hasCover && page.cover_url && (
            <CoverImage url={page.cover_url} />
          )}

          {/* Page header: icon + title */}
          <div
            className="mx-auto max-w-3xl px-6 sm:px-10"
            style={{ paddingTop: hasCover ? "1.5rem" : "3rem" }}
          >
            {hasIcon && page.icon && (
              <div className={hasCover ? "-mt-10 mb-4" : "mb-4"}>
                <PageIconDisplay icon={page.icon} />
              </div>
            )}

            <h1 className="mb-1 text-4xl font-bold tracking-tight text-foreground">
              {page.title || "Untitled"}
            </h1>

            <div className="mb-8 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                Last updated{" "}
                {new Date(page.updated_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            {/* Body — TipTap read-only renderer */}
            <DocView
              content={page.content ?? {}}
              className="pb-24"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
