"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  useCompleteRetro,
  useDeleteRetro,
  useRefreshRetroSnapshot,
  useReopenRetro,
  useRetroDetail,
  useUpdateRetro,
} from "../hooks/useRetros";
import { formatPeriod } from "../format";
import type { RetroDetail, RetroEntry, RetroSection } from "../types";
import { RETRO_KIND_LABELS, RETRO_SCOPE_LABELS } from "../types";
import { ActionsPanel } from "./ActionsPanel";
import {
  AutosaveTextarea,
  EntryListSection,
  ScoreInput,
  ScoreSection,
  TextSection,
  useAutosave,
} from "./SectionCards";
import { LinkedObjects } from "./LinkedObjects";
import { SnapshotBlock } from "./SnapshotBlock";

interface RetroEditorProps {
  retroId: string;
}

/** Single scrollable retro page: header, sections, linked objects, actions. */
export function RetroEditor({ retroId }: RetroEditorProps) {
  const { data, isLoading, isError, error } = useRetroDetail(retroId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading retro…
      </div>
    );
  }

  if (isError || !data) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">
          {notFound ? "This retro does not exist." : "Could not load this retro."}
        </p>
        <Link href="/retros" className="text-sm text-muted-foreground hover:underline">
          Back to retros
        </Link>
      </div>
    );
  }

  return <RetroEditorBody key={data.retro.id} detail={data} />;
}

// ─── Body ─────────────────────────────────────────────────────────────────────

function RetroEditorBody({ detail }: { detail: RetroDetail }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { retro, sections, entries, links, actions } = detail;

  const update = useUpdateRetro(retro.id);
  const refresh = useRefreshRetroSnapshot(retro.id);
  const complete = useCompleteRetro(retro.id);
  const reopen = useReopenRetro(retro.id);
  const remove = useDeleteRetro();

  const isDraft = retro.status === "draft";
  const busy = update.isPending || complete.isPending || reopen.isPending;

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections],
  );

  const entriesBySection = useMemo(() => {
    const map = new Map<string, RetroEntry[]>();
    for (const e of entries) {
      const list = map.get(e.section_id) ?? [];
      list.push(e);
      map.set(e.section_id, list);
    }
    return map;
  }, [entries]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete this retro?",
      description: "Its entries, links and actions are removed. This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    remove.mutate(retro.id, { onSuccess: () => router.push("/retros") });
  };

  const scopeText =
    retro.scope_type !== "none"
      ? `${RETRO_SCOPE_LABELS[retro.scope_type]}${retro.scope_label ? `: ${retro.scope_label}` : ""}`
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <Link
        href="/retros"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All retros
      </Link>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <TitleField
              initial={retro.title}
              onSave={(title) => update.mutate({ title })}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{RETRO_KIND_LABELS[retro.kind]}</Badge>
              <span>{formatPeriod(retro)}</span>
              {scopeText ? <span>· {scopeText}</span> : null}
              {isDraft ? (
                <Badge variant="outline">Draft</Badge>
              ) : (
                <Badge variant="secondary">
                  Completed{retro.completed_at ? ` ${new Date(retro.completed_at).toLocaleDateString()}` : ""}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDraft ? (
              <Button
                type="button"
                size="sm"
                disabled={busy || complete.isPending}
                onClick={() => complete.mutate()}
              >
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => reopen.mutate()}
              >
                <RotateCcw className="h-4 w-4" />
                Reopen
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Delete retro"
              disabled={remove.isPending}
              onClick={handleDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Rating</p>
            <ScoreInput
              kind="rating"
              value={retro.rating}
              disabled={busy}
              onChange={(rating) => update.mutate({ rating })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Mood</p>
            <ScoreInput
              kind="mood"
              value={retro.mood}
              disabled={busy}
              onChange={(mood) => update.mutate({ mood })}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── Sections ─────────────────────────────────────────────────── */}
        <main className="min-w-0 space-y-8">
          {orderedSections.map((section) => (
            <SectionBlock
              key={section.id}
              retro={retro}
              section={section}
              entries={entriesBySection.get(section.id) ?? []}
              onRefresh={() => refresh.mutate()}
              refreshing={refresh.isPending}
            />
          ))}

          {orderedSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">This retro has no sections.</p>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Summary</h2>
            <AutosaveTextarea
              key={`summary-${retro.id}`}
              initialValue={retro.summary ?? ""}
              rows={3}
              placeholder="One paragraph on how this period went…"
              ariaLabel="Summary"
              onSave={(summary) => update.mutate({ summary })}
            />
          </section>
        </main>

        {/* ── Side panels ──────────────────────────────────────────────── */}
        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Linked</CardTitle>
            </CardHeader>
            <CardContent>
              <LinkedObjects retroId={retro.id} links={links} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionsPanel retroId={retro.id} actions={actions} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ─── Title ────────────────────────────────────────────────────────────────────

function TitleField({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const { schedule, flush } = useAutosave<string>((t) => {
    if (t.trim()) onSave(t.trim());
  });
  return (
    <input
      aria-label="Retro title"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        schedule(e.target.value);
      }}
      onBlur={flush}
      className="w-full bg-transparent text-2xl font-semibold tracking-tight focus-visible:outline-none"
    />
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SectionBlock({
  retro,
  section,
  entries,
  onRefresh,
  refreshing,
}: {
  retro: RetroDetail["retro"];
  section: RetroSection;
  entries: RetroEntry[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const isMetrics = section.input_type === "auto_metrics";
  const sectionEntries = entries;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{section.title}</h2>
          {section.prompt ? (
            <p className="text-sm text-muted-foreground">{section.prompt}</p>
          ) : null}
        </div>
        {isMetrics && retro.status === "draft" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={onRefresh}
            className={cn(refreshing && "opacity-70")}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        ) : null}
      </div>

      {renderBody(retro, section, sectionEntries)}
    </section>
  );
}

function renderBody(
  retro: RetroDetail["retro"],
  section: RetroSection,
  entries: RetroEntry[],
) {
  switch (section.input_type) {
    case "auto_metrics":
      return (
        <SnapshotBlock snapshot={retro.snapshot} source={section.auto_source} />
      );
    case "cards":
      return (
        <EntryListSection
          retroId={retro.id}
          section={section}
          entries={entries}
        />
      );
    case "checklist":
      return (
        <EntryListSection
          retroId={retro.id}
          section={section}
          entries={entries}
          checklist
        />
      );
    case "text":
      return (
        <TextSection
          key={section.id}
          retroId={retro.id}
          section={section}
          entry={entries[0]}
        />
      );
    case "rating":
      return (
        <ScoreSection retroId={retro.id} kind="rating" value={retro.rating} />
      );
    case "mood":
      return <ScoreSection retroId={retro.id} kind="mood" value={retro.mood} />;
    default:
      return null;
  }
}
