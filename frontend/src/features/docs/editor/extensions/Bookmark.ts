import { Node, mergeAttributes } from "@tiptap/core";

export interface BookmarkAttrs {
  href: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      insertBookmark: (attrs: Pick<BookmarkAttrs, "href">) => ReturnType;
    };
  }
}

/**
 * Bookmark — link preview card (atom node, no editable content).
 *
 * Stores { href, title?, description?, image? }.  The node-view fetches
 * Open Graph metadata client-side if title is null.
 *
 * JSON shape:
 *   { "type": "bookmark", "attrs": { "href": "https://...", "title": "...", ... } }
 */
export const Bookmark = Node.create({
  name: "bookmark",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: {
        default: "",
        parseHTML: (element: Element) =>
          element.getAttribute("data-href") ?? "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-href": attributes.href as string,
        }),
      },
      title: {
        default: null,
        parseHTML: (element: Element) =>
          element.getAttribute("data-title") ?? null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.title ? { "data-title": attributes.title as string } : {},
      },
      description: {
        default: null,
        parseHTML: (element: Element) =>
          element.getAttribute("data-description") ?? null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.description
            ? { "data-description": attributes.description as string }
            : {},
      },
      image: {
        default: null,
        parseHTML: (element: Element) =>
          element.getAttribute("data-image") ?? null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.image ? { "data-image": attributes.image as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="bookmark"]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "bookmark" }),
    ];
  },

  addCommands() {
    return {
      insertBookmark:
        (attrs) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  // Node view registered externally in DocEditor.tsx via .extend({ addNodeView })
});
