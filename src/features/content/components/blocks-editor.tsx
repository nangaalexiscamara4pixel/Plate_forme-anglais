"use client";

import {
  AudioLines,
  BookA,
  Check,
  FileDown,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquareQuote,
  MonitorPlay,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmAction } from "@/features/students/components/confirm-action";
import { Link } from "@/i18n/navigation";
import { CALLOUT_TONES, type EditableBlockKind } from "../blocks";
import { addBlockAction, deleteBlockAction, reorderAction, saveBlockAction } from "../actions";
import { RichTextEditor } from "./rich-text-editor";
import { SortableList } from "./sortable-list";
import { FileDrop } from "@/components/file-drop";
import { ACCEPT } from "@/lib/files";
import { mimeFromName } from "@/features/media/policy";
import type { UploadedFile } from "./use-upload";

export type EditorBlock = { id: string; kind: string; content: Record<string, unknown>; videoId: string | null };
type VideoOption = { id: string; title: string; status: string };

const KIND_ICON: Record<EditableBlockKind, typeof FileText> = {
  RICH_TEXT: FileText,
  CALLOUT: MessageSquareQuote,
  VIDEO: MonitorPlay,
  AUDIO: AudioLines,
  IMAGE: ImageIcon,
  DOCUMENT: FileDown,
  VOCAB_LIST: BookA,
};
const ADDABLE: EditableBlockKind[] = ["RICH_TEXT", "CALLOUT", "VIDEO", "AUDIO", "IMAGE", "DOCUMENT", "VOCAB_LIST"];
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function BlocksEditor({
  lessonId,
  blocks: initial,
  videos,
  mediaNames,
}: {
  lessonId: string;
  blocks: EditorBlock[];
  videos: VideoOption[];
  mediaNames: Record<string, string>;
}) {
  const t = useTranslations("admin.editor");
  const te = useTranslations("errors");
  const [blocks, setBlocks] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    // Nouvelle version serveur (ajout / suppression) : on conserve les modifications locales des blocs existants.
    setPrevInitial(initial);
    setBlocks(initial.map((b) => blocks.find((x) => x.id === b.id) ?? b));
  }
  const [adding, startAdding] = useTransition();

  return (
    <div className="grid gap-4">
      <SortableList
        items={blocks}
        className="grid gap-4"
        onReorder={(next) => {
          const before = blocks;
          setBlocks(next);
          void reorderAction(null, { scope: "block", parentId: lessonId, orderedIds: next.map((b) => b.id) }).then((res) => {
            if (!res.ok) {
              setBlocks(before);
              toast.error(te.has(res.error) ? te(res.error) : te("generic"));
            }
          });
        }}
        renderItem={(block, handle) => (
          <BlockCard
            block={block}
            handle={handle}
            videos={videos}
            mediaNames={mediaNames}
            onLocalChange={(next) => setBlocks((all) => all.map((b) => (b.id === block.id ? next : b)))}
          />
        )}
      />

      <div className="rounded-xl border border-dashed p-4">
        <p className="mb-3 text-sm font-medium">{t("addBlock")}</p>
        <div className="flex flex-wrap gap-2">
          {ADDABLE.map((kind) => {
            const Icon = KIND_ICON[kind];
            return (
              <Button
                key={kind}
                type="button"
                variant="outline"
                size="sm"
                disabled={adding}
                onClick={() =>
                  startAdding(async () => {
                    const res = await addBlockAction(null, { lessonId, kind });
                    if (!res.ok) toast.error(te.has(res.error) ? te(res.error) : te("generic"));
                  })
                }
              >
                <Icon className="size-4" aria-hidden /> {t(`kind.${kind}`)}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  handle,
  videos,
  mediaNames,
  onLocalChange,
}: {
  block: EditorBlock;
  handle: ReactNode;
  videos: VideoOption[];
  mediaNames: Record<string, string>;
  onLocalChange: (b: EditorBlock) => void;
}) {
  const t = useTranslations("admin.editor");
  const te = useTranslations("errors");
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const kind = block.kind as EditableBlockKind;
  const Icon = KIND_ICON[kind] ?? FileText;

  const update = (patch: Partial<EditorBlock>) => {
    onLocalChange({ ...block, ...patch });
    setDirty(true);
  };
  const setContent = (patch: Record<string, unknown>) => update({ content: { ...block.content, ...patch } });

  const save = () =>
    startSaving(async () => {
      const res = await saveBlockAction(null, { blockId: block.id, content: block.content, videoId: kind === "VIDEO" ? block.videoId : undefined });
      if (res.ok) {
        setDirty(false);
        toast.success(t("blockSaved"));
      } else {
        toast.error(te.has(res.error) ? te(res.error) : te("generic"));
      }
    });

  return (
    <article className="rounded-xl border bg-card" aria-label={t(`kind.${kind}`)}>
      <header className="flex items-center gap-2 border-b px-3 py-2">
        {handle}
        <Icon className="size-4 text-brand-ink" aria-hidden />
        <span className="flex-1 text-sm font-medium">{t(`kind.${kind}`)}</span>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {dirty ? t("unsaved") : (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3" aria-hidden /> {t("saved")}
            </span>
          )}
        </span>
        <Button type="button" size="sm" variant={dirty ? "default" : "ghost"} onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {t("save")}
        </Button>
        <ConfirmAction
          action={deleteBlockAction}
          fields={{ blockId: block.id }}
          trigger={
            <Button type="button" variant="ghost" size="icon" aria-label={t("deleteBlock")}>
              <Trash2 className="size-4" aria-hidden />
            </Button>
          }
          title={t("deleteBlock")}
          description={t("deleteBlockBody")}
          confirmLabel={t("delete")}
          successMessage={t("blockDeleted")}
          destructive
        />
      </header>

      <div className="grid gap-4 p-4">
        {kind === "RICH_TEXT" && (
          <RichTextEditor label={t("kind.RICH_TEXT")} value={block.content.doc} onChange={(doc) => setContent({ doc })} placeholder={t("textPlaceholder")} />
        )}

        {kind === "CALLOUT" && (
          <>
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <div className="grid gap-2">
                <Label htmlFor={`tone-${block.id}`}>{t("tone")}</Label>
                <select id={`tone-${block.id}`} className={selectClass} value={String(block.content.tone ?? "tip")} onChange={(e) => setContent({ tone: e.target.value })}>
                  {CALLOUT_TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {t(`toneName.${tone}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`ct-${block.id}`}>{t("calloutTitle")}</Label>
                <Input id={`ct-${block.id}`} value={String(block.content.title ?? "")} maxLength={120} onChange={(e) => setContent({ title: e.target.value })} />
              </div>
            </div>
            <RichTextEditor compact label={t("kind.CALLOUT")} value={block.content.doc} onChange={(doc) => setContent({ doc })} />
          </>
        )}

        {kind === "VIDEO" && (
          <>
            <div className="grid gap-2">
              <Label htmlFor={`v-${block.id}`}>{t("video")}</Label>
              <select id={`v-${block.id}`} className={selectClass} value={block.videoId ?? ""} onChange={(e) => update({ videoId: e.target.value || null })}>
                <option value="">{t("chooseVideo")}</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.status !== "READY"}>
                    {v.title}
                    {v.status !== "READY" ? ` (${v.status})` : ""}
                  </option>
                ))}
              </select>
              <Link href="/admin/media" className="text-xs text-muted-foreground underline underline-offset-4">
                {t("manageVideos")}
              </Link>
            </div>
            <CaptionField id={block.id} value={String(block.content.caption ?? "")} onChange={(caption) => setContent({ caption })} />
          </>
        )}

        {(kind === "AUDIO" || kind === "IMAGE") && (
          <>
            <FileDrop
              uploader={kind === "AUDIO" ? "LESSON_AUDIO" : "LESSON_IMAGE"}
              accept={kind === "AUDIO" ? ACCEPT.audio : ACCEPT.image}
              pasteImages={kind === "IMAGE"}
              value={mediaValue(block.content.mediaId, mediaNames)}
              onChange={(m) => setContent({ mediaId: m?.id ?? "" })}
            />
            {kind === "IMAGE" && (
              <div className="grid gap-2">
                <Label htmlFor={`alt-${block.id}`}>{t("alt")}</Label>
                <Input id={`alt-${block.id}`} value={String(block.content.alt ?? "")} maxLength={300} required onChange={(e) => setContent({ alt: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t("altHint")}</p>
              </div>
            )}
            <CaptionField id={block.id} value={String(block.content.caption ?? "")} onChange={(caption) => setContent({ caption })} />
            {kind === "AUDIO" && (
              <div className="grid gap-2">
                <Label htmlFor={`tr-${block.id}`}>{t("transcript")}</Label>
                <Textarea id={`tr-${block.id}`} rows={4} maxLength={10_000} value={String(block.content.transcript ?? "")} onChange={(e) => setContent({ transcript: e.target.value })} />
              </div>
            )}
          </>
        )}

        {kind === "DOCUMENT" && (
          <>
            <FileDrop
              uploader="LESSON_DOCUMENT"
              accept={ACCEPT.document}
              pasteImages={false}
              hint={t("documentHint")}
              value={mediaValue(block.content.mediaId, mediaNames)}
              onChange={(m) => setContent({ mediaId: m?.id ?? "", title: block.content.title || (m?.name ?? "").replace(/.[^.]+$/, "") })}
            />
            <div className="grid gap-2">
              <Label htmlFor={`doc-title-${block.id}`}>{t("documentTitle")}</Label>
              <Input id={`doc-title-${block.id}`} value={String(block.content.title ?? "")} maxLength={200} required onChange={(e) => setContent({ title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`doc-desc-${block.id}`}>{t("documentDescription")}</Label>
              <Textarea id={`doc-desc-${block.id}`} rows={2} maxLength={500} value={String(block.content.description ?? "")} onChange={(e) => setContent({ description: e.target.value })} />
            </div>
          </>
        )}

        {kind === "VOCAB_LIST" && <VocabEditor content={block.content} onChange={setContent} />}
      </div>
    </article>
  );
}

function CaptionField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const t = useTranslations("admin.editor");
  return (
    <div className="grid gap-2">
      <Label htmlFor={`cap-${id}`}>{t("caption")}</Label>
      <Input id={`cap-${id}`} value={value} maxLength={300} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Fichier déjà choisi pour un bloc (nom connu de la médiathèque, type déduit de l'extension). */
function mediaValue(mediaId: unknown, names: Record<string, string>): UploadedFile | null {
  if (typeof mediaId !== "string" || !mediaId) return null;
  const name = names[mediaId] ?? "";
  return { id: mediaId, name, mime: mimeFromName(name) ?? "application/octet-stream" };
}

type VocabItem = { term: string; translation: string; partOfSpeech?: string; example?: string };

function VocabEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  const t = useTranslations("admin.editor");
  const items = (Array.isArray(content.items) ? content.items : []) as VocabItem[];
  const setItem = (i: number, patch: Partial<VocabItem>) => onChange({ items: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="vocab-title">{t("vocabTitle")}</Label>
        <Input id="vocab-title" value={String(content.title ?? "")} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="grid gap-2">
        {items.map((item, i) => (
          <fieldset key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
            <legend className="sr-only">{t("vocabRow", { n: i + 1 })}</legend>
            <Input aria-label={t("term")} placeholder={t("term")} value={item.term} maxLength={120} onChange={(e) => setItem(i, { term: e.target.value })} />
            <Input aria-label={t("translation")} placeholder={t("translation")} value={item.translation} maxLength={200} onChange={(e) => setItem(i, { translation: e.target.value })} />
            <Input aria-label={t("partOfSpeech")} placeholder={t("partOfSpeech")} value={item.partOfSpeech ?? ""} maxLength={40} onChange={(e) => setItem(i, { partOfSpeech: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" aria-label={t("removeRow")} onClick={() => onChange({ items: items.filter((_, j) => j !== i) })}>
              <X className="size-4" aria-hidden />
            </Button>
            <Input
              aria-label={t("example")}
              placeholder={t("example")}
              value={item.example ?? ""}
              maxLength={300}
              className="sm:col-span-4"
              onChange={(e) => setItem(i, { example: e.target.value })}
            />
          </fieldset>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={items.length >= 60} onClick={() => onChange({ items: [...items, { term: "", translation: "" }] })}>
        <Plus className="size-4" aria-hidden /> {t("addRow")}
      </Button>
    </div>
  );
}
