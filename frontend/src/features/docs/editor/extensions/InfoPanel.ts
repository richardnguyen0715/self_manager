import { Node, mergeAttributes } from "@tiptap/core";

export type InfoPanelVariant = "info" | "note" | "warning" | "success";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    infoPanel: {
      insertInfoPanel: (variant?: InfoPanelVariant) => ReturnType;
    };
  }
}

export const InfoPanel = Node.create({
  name: "infoPanel",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      variant: {
        default: "info" as InfoPanelVariant,
        parseHTML: (element: Element) =>
          (element.getAttribute("data-variant") as InfoPanelVariant) ?? "info",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-variant": attributes.variant as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="info-panel"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "info-panel" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertInfoPanel:
        (variant: InfoPanelVariant = "info") =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { variant },
            content: [{ type: "paragraph" }],
          });
        },
    };
  },
});
