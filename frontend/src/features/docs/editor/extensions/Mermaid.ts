import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mermaid: {
      insertMermaid: (code?: string) => ReturnType;
    };
  }
}

export const Mermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      code: {
        default: "graph TD\n  A[Start] --> B[End]",
        parseHTML: (element: Element) =>
          element.getAttribute("data-code") ??
          "graph TD\n  A[Start] --> B[End]",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-code": attributes.code as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "mermaid" }),
    ];
  },

  addCommands() {
    return {
      insertMermaid:
        (code = "graph TD\n  A[Start] --> B[End]") =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { code },
          });
        },
    };
  },
});
