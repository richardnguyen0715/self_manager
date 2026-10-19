"use client";

import { createRoot, type Root } from "react-dom/client";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query";
import { MentionList } from "./MentionList";
import type { MentionListHandle } from "./MentionList";
import type { MentionSearchResult } from "./types";

export interface MentionSuggestionOptions {
  /**
   * Optional override for what gets inserted. Return true when the item was
   * handled (the default chip is then not inserted). DocEditor can use this
   * to insert a `pageMention` for docs.
   */
  onSelect?: (item: MentionSearchResult, editor: Editor, range: Range) => boolean | void;
}

const pluginKey = new PluginKey("entityMentionSuggestion");

/**
 * MentionSuggestion: the "@" trigger and popup. Put it in an editor's
 * extensions array next to EntityMention; no options are required.
 */
export const MentionSuggestion = Extension.create<MentionSuggestionOptions>({
  name: "entityMentionSuggestion",

  addOptions() {
    return { onSelect: undefined };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      Suggestion<MentionSearchResult, MentionSearchResult>({
        editor: this.editor,
        pluginKey,
        char: "@",
        allowSpaces: false,
        startOfLine: false,
        // "@" only triggers at the start of a text run or after a space or "(".
        // Keeps emails like a@b.com from opening the picker.
        allowedPrefixes: [" ", "("],
        // Results come from the popup's own react-query search.
        items: () => [],
        command: ({ editor, range, props }) => {
          if (options.onSelect?.(props, editor, range)) return;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "entityMention",
                attrs: {
                  mentionType: props.type,
                  mentionId: props.id,
                  label: props.title,
                },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: () => {
          let root: Root | null = null;
          let popup: ReturnType<typeof tippy> | null = null;
          let list: MentionListHandle | null = null;
          let dismissed = false;

          const draw = (props: SuggestionProps<MentionSearchResult, MentionSearchResult>) => {
            // The popup lives in its own React root, outside the app's
            // providers, so it needs the shared query client explicitly.
            root?.render(
              <QueryClientProvider client={queryClient}>
                <MentionList
                  ref={(handle) => {
                    list = handle;
                  }}
                  query={props.query}
                  command={(item) => props.command(item)}
                />
              </QueryClientProvider>,
            );
          };

          const place = (props: SuggestionProps<MentionSearchResult, MentionSearchResult>) => {
            popup?.[0]?.setProps({
              getReferenceClientRect: (props.clientRect ?? (() => new DOMRect())) as () => DOMRect,
            });
          };

          return {
            onStart(props) {
              dismissed = false;
              const container = document.createElement("div");
              root = createRoot(container);
              draw(props);
              popup = tippy("body", {
                getReferenceClientRect: (props.clientRect ?? (() => new DOMRect())) as () => DOMRect,
                appendTo: () => document.body,
                content: container,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                maxWidth: "none",
              });
            },

            onUpdate(props) {
              draw(props);
              if (!dismissed) place(props);
            },

            onKeyDown({ event }: SuggestionKeyDownProps) {
              if (event.key === "Escape") {
                if (dismissed) return false;
                dismissed = true;
                popup?.[0]?.hide();
                return true;
              }
              if (dismissed) return false;
              return list?.onKeyDown({ event }) ?? false;
            },

            onExit() {
              popup?.[0]?.destroy();
              popup = null;
              root?.unmount();
              root = null;
              list = null;
            },
          };
        },
      }),
    ];
  },
});
