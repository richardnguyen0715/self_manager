"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Code2,
  Quote,
  Minus,
  Image,
  Table,
  Link2,
  Columns2,
  ChevronDown,
  Smile,
  Plus,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  AtSign,
  GitGraph,
  ListTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { EmojiPicker } from "./EmojiPicker";

const EMOJI_LIST = [
  "😀","😂","🥰","😎","🤔","😅","😊","🙏","👍","🎉",
  "🔥","✅","❌","⚠️","📌","💡","🚀","📝","🎯","🗓️",
  "📎","🔗","💬","📊","📈","🧠","⚡","🌟","💎","🏆",
];

interface ToolbarProps {
  editor: Editor;
  onImageUpload?: (file: File) => Promise<string>;
}

type TextStyle =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3";

const TEXT_STYLE_OPTIONS: { label: string; value: TextStyle; icon: React.ElementType }[] = [
  { label: "Paragraph", value: "paragraph", icon: Pilcrow },
  { label: "Heading 1", value: "heading1", icon: Heading1 },
  { label: "Heading 2", value: "heading2", icon: Heading2 },
  { label: "Heading 3", value: "heading3", icon: Heading3 },
];

function getActiveStyle(editor: Editor): TextStyle {
  if (editor.isActive("heading", { level: 1 })) return "heading1";
  if (editor.isActive("heading", { level: 2 })) return "heading2";
  if (editor.isActive("heading", { level: 3 })) return "heading3";
  return "paragraph";
}

function applyStyle(editor: Editor, style: TextStyle) {
  if (style === "paragraph") {
    editor.chain().focus().setParagraph().run();
  } else if (style === "heading1") {
    editor.chain().focus().setHeading({ level: 1 }).run();
  } else if (style === "heading2") {
    editor.chain().focus().setHeading({ level: 2 }).run();
  } else if (style === "heading3") {
    editor.chain().focus().setHeading({ level: 3 }).run();
  }
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, title, disabled, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded text-sm transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

export function Toolbar({ editor, onImageUpload }: ToolbarProps) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const activeStyle = getActiveStyle(editor);
  const ActiveStyleIcon =
    TEXT_STYLE_OPTIONS.find((o) => o.value === activeStyle)?.icon ?? Pilcrow;

  const handleImageFile = async (file: File) => {
    if (!onImageUpload) return;
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // swallow — caller logs
    }
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImageFile(file);
    e.target.value = "";
  };

  const insertLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background/95 backdrop-blur-sm px-3 py-1.5">
      {/* Text style dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setStyleOpen((o) => !o)}
          className="flex h-7 items-center gap-1.5 rounded px-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <ActiveStyleIcon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs font-medium">
            {TEXT_STYLE_OPTIONS.find((o) => o.value === activeStyle)?.label ?? "Paragraph"}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {styleOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border bg-popover shadow-lg">
            {TEXT_STYLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    applyStyle(editor, opt.value);
                    setStyleOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                    activeStyle === opt.value
                      ? "bg-accent text-accent-foreground"
                      : "text-popover-foreground hover:bg-accent/60",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* Bold / Italic / Underline / Strike */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline code"
      >
        <Code2 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="Task list"
      >
        <CheckSquare className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Align left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Align center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="Align right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        isActive={editor.isActive({ textAlign: "justify" })}
        title="Justify"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator />

      {/* Insert */}
      <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Upload image">
        <Image className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().insertContent("@").run()
        }
        title="Mention (@)"
      >
        <AtSign className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="relative">
        <ToolbarButton
          onClick={() => setEmojiOpen((o) => !o)}
          title="Emoji"
        >
          <Smile className="h-3.5 w-3.5" />
        </ToolbarButton>
        {emojiOpen && (
          <EmojiPicker
            emojis={EMOJI_LIST}
            onSelect={(emoji) => {
              editor.chain().focus().insertContent(emoji).run();
              setEmojiOpen(false);
            }}
            onClose={() => setEmojiOpen(false)}
          />
        )}
      </div>
      <ToolbarButton
        onClick={() => editor.chain().focus().insertColumns().run()}
        title="Two columns"
      >
        <Columns2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        title="Table"
      >
        <Table className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().insertMermaid().run()}
        title="Mermaid diagram"
      >
        <GitGraph className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().insertTableOfContents().run()}
        title="Table of contents"
      >
        <ListTree className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={insertLink} isActive={editor.isActive("link")} title="Link">
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator />

      {/* Slash command hint */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().insertContent("/").run()
        }
        title="Slash commands"
      >
        <Plus className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Hidden file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageInputChange}
      />
    </div>
  );
}
