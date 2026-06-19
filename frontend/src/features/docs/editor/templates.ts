import type { TipTapDoc } from "@/types";

export interface DocTemplate {
  id: string;
  label: string;
  description: string;
  content: TipTapDoc;
}

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Start from an empty page",
    content: {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
  },
  {
    id: "1on1",
    label: "1-on-1 Meeting",
    description: "Structured notes for a 1-on-1 meeting",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "1-on-1 Meeting" }] },
        {
          type: "infoPanel",
          attrs: { variant: "info" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Date: | Attendees: Manager · Report" }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Agenda" }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Updates from last meeting" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Current priorities" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Blockers / help needed" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Career / growth topics" }] }] },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Notes" }] },
        { type: "paragraph", content: [{ type: "text", text: "" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Action item (owner)" }] }],
            },
          ],
        },
      ],
    },
  },
  {
    id: "4ls",
    label: "4 Ls Retrospective",
    description: "Loved, Learned, Lacked, Longed For",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "4 Ls Retrospective" }] },
        {
          type: "infoPanel",
          attrs: { variant: "note" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Sprint / Period: | Date: | Facilitator:" }],
            },
          ],
        },
        {
          type: "columns",
          content: [
            {
              type: "column",
              content: [
                { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Loved" }] },
                {
                  type: "bulletList",
                  content: [
                    { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "What went really well?" }] }] },
                  ],
                },
              ],
            },
            {
              type: "column",
              content: [
                { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Learned" }] },
                {
                  type: "bulletList",
                  content: [
                    { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "What did you learn?" }] }] },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "columns",
          content: [
            {
              type: "column",
              content: [
                { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Lacked" }] },
                {
                  type: "bulletList",
                  content: [
                    { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "What was missing?" }] }] },
                  ],
                },
              ],
            },
            {
              type: "column",
              content: [
                { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Longed For" }] },
                {
                  type: "bulletList",
                  content: [
                    { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "What do you wish you had?" }] }] },
                  ],
                },
              ],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Action Items" }] },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Action item" }] }],
            },
          ],
        },
      ],
    },
  },
  {
    id: "5whys",
    label: "5 Whys Analysis",
    description: "Root cause analysis template",
    content: {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "5 Whys Analysis" }] },
        {
          type: "infoPanel",
          attrs: { variant: "warning" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Problem Statement: Describe the issue clearly here." }],
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why #1" }] },
        { type: "paragraph", content: [{ type: "text", text: "Why did the problem occur? " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why #2" }] },
        { type: "paragraph", content: [{ type: "text", text: "Why did that happen? " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why #3" }] },
        { type: "paragraph", content: [{ type: "text", text: "Why did that happen? " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why #4" }] },
        { type: "paragraph", content: [{ type: "text", text: "Why did that happen? " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Why #5" }] },
        { type: "paragraph", content: [{ type: "text", text: "Root Cause: " }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Corrective Actions" }] },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Corrective action item" }] }],
            },
          ],
        },
        {
          type: "infoPanel",
          attrs: { variant: "success" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Root cause identified and actions planned." }],
            },
          ],
        },
      ],
    },
  },
];
