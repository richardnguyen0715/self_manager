"use client";

import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { FileText, Database } from "lucide-react";
import { DocsSearchResultItem } from "./DocsSearchResultItem";
import type { PageSearchHit, DatabaseSearchHit } from "@/types";
import type { DocsPageHit, DocsDatabaseHit } from "./DocsSearchResultItem";

// ─── Props ─────────────────────────────────────────────────────────────────────

interface DocsSearchGroupProps {
  pages: PageSearchHit[];
  databases: DatabaseSearchHit[];
  /** Called after a result is selected so the palette can close. */
  onNavigate: () => void;
  /** Maximum number of items to show per group before truncating. Defaults to 5. */
  maxPerGroup?: number;
}

/**
 * Renders two `cmdk` Command.Group sections — one for Pages, one for Databases
 * — ready to be dropped inside a `<Command.List>` in the command palette.
 *
 * Each item delegates routing + close handling to DocsSearchResultItem.
 */
export function DocsSearchGroup({
  pages,
  databases,
  onNavigate,
  maxPerGroup = 5,
}: DocsSearchGroupProps) {
  const router = useRouter();
  const visiblePages = pages.slice(0, maxPerGroup);
  const visibleDatabases = databases.slice(0, maxPerGroup);

  const hasPages = visiblePages.length > 0;
  const hasDatabases = visibleDatabases.length > 0;

  if (!hasPages && !hasDatabases) return null;

  return (
    <>
      {/* ── Pages group ───────────────────────────────────────────────────── */}
      {hasPages && (
        <Command.Group
          heading={
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3 w-3" />
              Pages
              {pages.length > maxPerGroup && (
                <span className="ml-auto normal-case font-normal">
                  +{pages.length - maxPerGroup} more
                </span>
              )}
            </span>
          }
        >
          {visiblePages.map((page) => {
            const hit: DocsPageHit = { ...page, kind: "page" };
            return (
              <Command.Item
                key={`docs-page-${page.id}`}
                value={`docs-page-${page.id}-${page.title}`}
                onSelect={() => {
                  router.push(`/docs/page/${page.id}`);
                  onNavigate();
                }}
                className="p-0"
              >
                <DocsSearchResultItem
                  hit={hit}
                  onNavigate={onNavigate}
                  className="rounded-none"
                />
              </Command.Item>
            );
          })}
        </Command.Group>
      )}

      {/* ── Databases group ───────────────────────────────────────────────── */}
      {hasDatabases && (
        <Command.Group
          heading={
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Database className="h-3 w-3" />
              Databases
              {databases.length > maxPerGroup && (
                <span className="ml-auto normal-case font-normal">
                  +{databases.length - maxPerGroup} more
                </span>
              )}
            </span>
          }
        >
          {visibleDatabases.map((db) => {
            const hit: DocsDatabaseHit = { ...db, kind: "database" };
            return (
              <Command.Item
                key={`docs-db-${db.id}`}
                value={`docs-db-${db.id}-${db.title}`}
                onSelect={() => {
                  router.push(`/docs/db/${db.id}`);
                  onNavigate();
                }}
                className="p-0"
              >
                <DocsSearchResultItem
                  hit={hit}
                  onNavigate={onNavigate}
                  className="rounded-none"
                />
              </Command.Item>
            );
          })}
        </Command.Group>
      )}
    </>
  );
}
