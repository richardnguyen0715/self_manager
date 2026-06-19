import { Node, mergeAttributes } from "@tiptap/core";

export type CalloutVariant = "info" | "note" | "warning" | "success" | "error";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: (variant?: CalloutVariant, emoji?: string) => ReturnType;
    };
  }
}

/**
 * Callout — Notion-style callout block with an emoji icon.
 *
 * This is distinct from InfoPanel (which uses a lucide icon + variant chip).
 * Callout stores an explicit emoji glyph in `attrs.emoji` and a visual variant.
 *
 * JSON shape:
 *   { "type": "callout",
 *     "attrs": { "variant": "info", "emoji": "💡" },
 *     "content": [{ "type": "paragraph", "content": [...] }]
 *   }
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (element: Element) =>
          (element.getAttribute("data-variant") as CalloutVariant) ?? "info",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-variant": attributes.variant as string,
        }),
      },
      emoji: {
        default: "💡",
        parseHTML: (element: Element) =>
          element.getAttribute("data-emoji") ?? "💡",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-emoji": attributes.emoji as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertCallout:
        (variant: CalloutVariant = "info", emoji = "💡") =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { variant, emoji },
            content: [{ type: "paragraph" }],
          });
        },
    };
  },

  // Node view registered externally in DocEditor.tsx via .extend({ addNodeView })
});
