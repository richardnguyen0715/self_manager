# TipTap Extensions Registry

This file is a placeholder for the editor agent.

The editor agent owns `features/docs/editor/` and is responsible for registering all TipTap extensions there.

Extensions required per DOCS-CONTRACT.md Section E.1 / D:

## StarterKit (covers)
- doc, paragraph, text
- bold, italic, strike
- heading (h1-h6)
- bulletList, orderedList
- blockquote, horizontalRule, hardBreak
- history
- code (inline)
- NOTE: StarterKit codeBlock is disabled; replaced by CodeBlockLowlight below

## Additional extensions
- @tiptap/extension-underline
- @tiptap/extension-text-align (left/center/right/justify)
- @tiptap/extension-task-list + @tiptap/extension-task-item
- @tiptap/extension-code-block-lowlight (paired with lowlight ^3)
- @tiptap/extension-table + -table-row + -table-header + -table-cell
- @tiptap/extension-image (src = /uploads/<file>)
- @tiptap/extension-link
- @tiptap/extension-placeholder
- @tiptap/extension-mention (+ tippy.js for suggestion popup)
- @tiptap/extension-character-count
- @tiptap/suggestion (transitive; powers slash menu + mention)

## Custom node types (editor agent implements as Node/NodeView)
- infoPanel   — attrs: { variant: 'info' | 'note' | 'warning' }
- columns     — wrapper with 2 column children
- mermaid     — attrs: { code: string }; renders via mermaid lib
- tableOfContents — scans headings, renders anchored list

## Notes
- Emoji: plain glyph insert via a small static list; no emoji-data lib needed
- Templates: static TipTap JSON fragments (1-on-1 Meeting, 4 Ls Retro, 5 Whys, blank)
- Excalidraw whiteboard: editor agent imports @excalidraw/excalidraw via next/dynamic (ssr: false)
