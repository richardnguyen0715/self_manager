import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    databaseEmbed: {
      insertDatabaseEmbed: (databaseId: string) => ReturnType;
    };
  }
}

/**
 * DatabaseEmbed — an atom node that stores only a databaseId.
 *
 * JSON shape:
 *   { "type": "databaseEmbed", "attrs": { "databaseId": "<uuid>" } }
 *
 * The node-view lazy-imports DatabaseEmbed from @/features/docs/database and
 * renders the live DatabaseView. Deleting the database leaves a graceful
 * "database not found" placeholder.
 */
export const DatabaseEmbed = Node.create({
  name: "databaseEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      databaseId: {
        default: "",
        parseHTML: (element: Element) =>
          element.getAttribute("data-database-id") ?? "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-database-id": attributes.databaseId as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="database-embed"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "database-embed" }),
    ];
  },

  addCommands() {
    return {
      insertDatabaseEmbed:
        (databaseId: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { databaseId },
          });
        },
    };
  },

  // Node view registered externally in DocEditor.tsx via .extend({ addNodeView })
});
