import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      insertEmbed: (src: string) => ReturnType;
    };
  }
}

/**
 * Embed — sandboxed iframe for arbitrary URLs.
 *
 * JSON shape:
 *   { "type": "embed", "attrs": { "src": "https://..." } }
 */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element: Element) =>
          element.getAttribute("data-src") ?? "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-src": attributes.src as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "embed" }),
    ];
  },

  addCommands() {
    return {
      insertEmbed:
        (src: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { src },
          });
        },
    };
  },

  // Node view registered externally in DocEditor.tsx via .extend({ addNodeView })
});
