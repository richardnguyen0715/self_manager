// ─── Keyboard shortcut registry ───────────────────────────────────────────────
// Single source of truth for the shortcuts dialog and the global hotkey hook.
// `sequence` is the key input the hook matches (chords are two lowercase keys,
// e.g. "gb" = press g, then b). Display-only entries omit `sequence`.

export type ShortcutGroup = "Navigation" | "Create" | "General";

export type ShortcutAction =
  | { type: "navigate"; href: string }
  | { type: "create"; kind: "work-item" | "sprint" }
  | { type: "open-shortcuts" }
  | { type: "open-command-palette" };

export interface ShortcutDef {
  id: string;
  group: ShortcutGroup;
  description: string;
  /** Key chips rendered in the dialog, e.g. ["G", "B"] or ["Ctrl/⌘", "K"]. */
  keys: string[];
  /** How the key chips are joined: "then" for chords, "+" for combos. */
  joiner?: "then" | "+";
  /** Chord sequence matched by the global hook (two lowercase letters). */
  sequence?: string;
  action?: ShortcutAction;
}

/** Modal id used with useUIStore().openModal / activeModal. */
export const SHORTCUTS_MODAL_ID = "shortcuts";

const NAV_CHORDS: { key: string; label: string; href: string }[] = [
  { key: "b", label: "Board", href: "/board" },
  { key: "l", label: "Backlog", href: "/backlog" },
  { key: "s", label: "Sprints", href: "/sprints" },
  { key: "w", label: "Work items", href: "/work-items" },
  { key: "d", label: "Dashboard", href: "/dashboard" },
  { key: "c", label: "Calendar", href: "/calendar" },
  { key: "h", label: "Habits", href: "/habits" },
  { key: "o", label: "Docs", href: "/docs" },
  { key: "a", label: "Analytics", href: "/analytics" },
  { key: "t", label: "Trash", href: "/trash" },
  { key: "f", label: "Focus", href: "/focus" },
  { key: "g", label: "Goals", href: "/goals" },
  { key: "r", label: "Retros", href: "/retros" },
];

export const SHORTCUTS: ShortcutDef[] = [
  ...NAV_CHORDS.map<ShortcutDef>(({ key, label, href }) => ({
    id: `nav-${key}`,
    group: "Navigation",
    description: `Go to ${label}`,
    keys: ["G", key.toUpperCase()],
    joiner: "then",
    sequence: `g${key}`,
    action: { type: "navigate", href },
  })),

  {
    id: "create-work-item",
    group: "Create",
    description: "New work item",
    keys: ["N", "W"],
    joiner: "then",
    sequence: "nw",
    action: { type: "create", kind: "work-item" },
  },
  {
    id: "create-sprint",
    group: "Create",
    description: "New sprint",
    keys: ["N", "S"],
    joiner: "then",
    sequence: "ns",
    action: { type: "create", kind: "sprint" },
  },

  {
    id: "command-palette",
    group: "General",
    description: "Open command palette",
    keys: ["Ctrl/⌘", "K"],
    joiner: "+",
    action: { type: "open-command-palette" },
  },
  {
    id: "shortcuts-dialog",
    group: "General",
    description: "Show keyboard shortcuts",
    keys: ["?"],
    action: { type: "open-shortcuts" },
  },
  {
    id: "shortcuts-dialog-combo",
    group: "General",
    description: "Show keyboard shortcuts (alternative)",
    keys: ["Ctrl/⌘", "/"],
    joiner: "+",
    action: { type: "open-shortcuts" },
  },
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = ["Navigation", "Create", "General"];
