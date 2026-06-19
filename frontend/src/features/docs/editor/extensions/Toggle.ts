import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggle: {
      insertToggle: (label?: string) => ReturnType;
    };
  }
}

/**
 * Toggle — collapsible details/summary block.
 *
 * JSON shape:
 *   { "type": "toggle", "attrs": { "open": true },
 *     "content": [
 *       { "type": "toggleSummary", "content": [...inline] },
 *       { "type": "paragraph", ... },
 *       ...
 *     ]
 *   }
 *
 * The first child MUST be a `toggleSummary`; remaining children are the
 * collapsible body rendered only when `open` is true.
 */
export const ToggleSummary = Node.create({
  name: "toggleSummary",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-summary"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle-summary" }),
      0,
    ];
  },
});

export const Toggle = Node.create({
  name: "toggle",
  group: "block",
  // First child is the summary, rest are body blocks
  content: "toggleSummary block*",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element: Element) =>
          element.getAttribute("data-open") !== "false",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-open": String(attributes.open),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toggle" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertToggle:
        (label = "Toggle heading") =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [
              {
                type: "toggleSummary",
                content: [{ type: "text", text: label }],
              },
              { type: "paragraph" },
            ],
          });
        },
    };
  },

  // Node view is registered externally in DocEditor.tsx via .extend({ addNodeView })
  // This pattern keeps the extension files free of React imports, which is cleaner
  // for SSR and tree-shaking. DocEditor re-extends Toggle to attach ToggleView.
});
