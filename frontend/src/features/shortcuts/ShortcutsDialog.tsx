"use client";

import { Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUIStore } from "@/stores";
import { SHORTCUT_GROUPS, SHORTCUTS, SHORTCUTS_MODAL_ID, type ShortcutDef } from "./shortcuts";

function Keys({ def }: { def: ShortcutDef }) {
  const separator = def.joiner === "+" ? "+" : "then";
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      {def.keys.map((k, i) => (
        <Fragment key={`${def.id}-${i}`}>
          {i > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {separator}
            </span>
          )}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {k}
          </kbd>
        </Fragment>
      ))}
    </span>
  );
}

export function ShortcutsDialog() {
  const { activeModal, closeModal } = useUIStore();
  const open = activeModal === SHORTCUTS_MODAL_ID;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeModal()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">?</kbd> any time to
            open this list. Chords must be pressed within about a second.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map((group) => {
            const rows = SHORTCUTS.filter((s) => s.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`shortcuts-${group}`}>
                <h3
                  id={`shortcuts-${group}`}
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {group}
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map((def) => (
                      <tr key={def.id} className="border-b last:border-b-0">
                        <td className="py-1.5 pr-3">{def.description}</td>
                        <td className="py-1.5 text-right">
                          <Keys def={def} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
