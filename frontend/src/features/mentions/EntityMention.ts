import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MentionChipView } from "./MentionChipView";
import type { MentionType } from "./types";

export interface EntityMentionAttrs {
  mentionType: MentionType;
  mentionId: string;
  /** Last known title. The chip shows the live title once resolved. */
  label: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    entityMention: {
      insertEntityMention: (attrs: EntityMentionAttrs) => ReturnType;
    };
  }
}

/**
 * EntityMention: inline atom that references any object (task, doc, sprint,
 * project, epic, initiative, goal, habit, retro).
 *
 * JSON: { "type": "entityMention", "attrs": { "mentionType", "mentionId", "label" } }
 *
 * HTML (round-trips through description/notes HTML):
 *   <span data-entity-mention data-mention-type="work_item" data-mention-id="<uuid>" data-label="Title">@Title</span>
 */
export const EntityMention = Node.create({
  name: "entityMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      mentionType: {
        default: "work_item",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-mention-type") ?? "work_item",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-mention-type": attributes.mentionType as string,
        }),
      },
      mentionId: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-mention-id") ?? "",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-mention-id": attributes.mentionId as string,
        }),
      },
      label: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-label") ??
          (element.textContent ?? "").replace(/^@/, ""),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-label": attributes.label as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-entity-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = (node.attrs.label as string) || "Untitled";
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-entity-mention": "" }),
      `@${label}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionChipView);
  },

  addCommands() {
    return {
      insertEntityMention:
        (attrs: EntityMentionAttrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
