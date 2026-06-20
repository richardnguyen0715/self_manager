import { Node, mergeAttributes } from "@tiptap/core";

export interface PageMentionAttrs {
  pageId: string;
  label: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageMention: {
      insertPageMention: (attrs: PageMentionAttrs) => ReturnType;
    };
  }
}

/**
 * PageMention — inline atom that records an @page reference.
 *
 * JSON shape:
 *   { "type": "pageMention", "attrs": { "pageId": "<uuid>", "label": "Page title" } }
 *
 * On the next content save, the backend parses all pageMention nodes and
 * re-syncs page_links for the source page (delete-for-source + insert-distinct).
 * No separate client call is required.
 *
 * Renders as an anchor link to /docs/page/:pageId in the editor (read-only
 * in the ProseMirror HTML serialisation; node-view handles editor rendering).
 */
export const PageMention = Node.create({
  name: "pageMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      pageId: {
        default: "",
        parseHTML: (element: Element) =>
          element.getAttribute("data-page-id") ?? "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-page-id": attributes.pageId as string,
        }),
      },
      label: {
        default: "",
        parseHTML: (element: Element) =>
          element.getAttribute("data-label") ??
          element.textContent ??
          "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-label": attributes.label as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="page-mention"]' }];
  },

  renderHTML({
    node,
    HTMLAttributes,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: any;
    HTMLAttributes: Record<string, unknown>;
  }) {
    // The text label lives on the node attrs (HTMLAttributes has it serialized
    // as data-label, so read node.attrs.label for the visible chip text).
    const label = (node?.attrs?.label as string) || "Untitled";
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "page-mention",
        class: "page-mention",
      }),
      `@${label}`,
    ];
  },

  addCommands() {
    return {
      insertPageMention:
        (attrs: PageMentionAttrs) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
