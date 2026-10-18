"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRetroActions } from "../hooks/useRetroChildren";
import { ActionRow } from "./ActionsPanel";

/** Every open action across all retros, with carry badges and convert buttons. */
export function OpenActionsCard({ className }: { className?: string }) {
  const { data, isLoading, isError } = useRetroActions("open");
  const actions = data ?? [];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          Open actions
          {actions.length > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">{actions.length}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : null}
        {isError ? <p className="text-sm text-destructive">Could not load actions.</p> : null}
        {!isLoading && !isError && actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open actions. Nice.</p>
        ) : null}
        <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {actions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              source={{
                href: `/retros/${a.retro_id}`,
                label: `${a.retro_title}`,
              }}
            />
          ))}
        </ul>
        <Link href="/retros/trends" className="inline-block pt-1 text-xs text-muted-foreground hover:underline">
          View trends
        </Link>
      </CardContent>
    </Card>
  );
}
