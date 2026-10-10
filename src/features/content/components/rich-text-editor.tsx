"use client";

import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Underline,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Éditeur de texte riche (TipTap). Seules les extensions correspondant à la liste blanche
 * du serveur sont activées ; le JSON produit est de toute façon revalidé côté serveur.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  compact = false,
  label,
}: {
  value: unknown;
  onChange: (doc: unknown) => void;
  placeholder?: string;
  compact?: boolean;
  label: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], defaultProtocol: "https" },
      }),
      Highlight,
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: (value as object) ?? undefined,
    editorProps: {
      attributes: {
        class: cn("prose-academy min-h-32 px-4 py-3 outline-none", compact && "min-h-20 text-base"),
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  return (
    <div className="rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/40">
      {editor && <Toolbar editor={editor} compact={compact} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Btn({
  active,
  onClick,
  label,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, compact }: { editor: Editor; compact: boolean }) {
  const t = useTranslations("admin.editor");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("linkPrompt"), previous ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") editor.chain().focus().unsetLink().run();
    else if (/^(https?:\/\/|mailto:)/i.test(url)) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div role="toolbar" aria-label={t("toolbar")} className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
      <Btn label={t("bold")} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" aria-hidden />
      </Btn>
      <Btn label={t("italic")} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" aria-hidden />
      </Btn>
      <Btn label={t("underline")} active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="size-4" aria-hidden />
      </Btn>
      <Btn label={t("strike")} active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" aria-hidden />
      </Btn>
      <Btn label={t("highlight")} active={state.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className="size-4" aria-hidden />
      </Btn>
      <Btn label={t("link")} active={state.link} onClick={setLink}>
        <Link2 className="size-4" aria-hidden />
      </Btn>
      {!compact && (
        <>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Btn label={t("h2")} active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="size-4" aria-hidden />
          </Btn>
          <Btn label={t("h3")} active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="size-4" aria-hidden />
          </Btn>
          <Btn label={t("h4")} active={state.h4} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
            <Heading4 className="size-4" aria-hidden />
          </Btn>
        </>
      )}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Btn label={t("bulletList")} active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" aria-hidden />
      </Btn>
      <Btn label={t("orderedList")} active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" aria-hidden />
      </Btn>
      {!compact && (
        <>
          <Btn label={t("quote")} active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-4" aria-hidden />
          </Btn>
          <Btn label={t("divider")} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="size-4" aria-hidden />
          </Btn>
          <Btn label={t("table")} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table className="size-4" aria-hidden />
          </Btn>
        </>
      )}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <Btn label={t("undo")} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-4" aria-hidden />
      </Btn>
      <Btn label={t("redo")} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-4" aria-hidden />
      </Btn>
    </div>
  );
}
