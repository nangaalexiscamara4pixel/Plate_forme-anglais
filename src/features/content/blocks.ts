import { z } from "zod";
import { RichTextError, sanitizeRichDoc, type RichNode } from "./rich-text";

/**
 * Une leçon est une suite ordonnée de blocs. Le champ `content` (JSON) de chaque bloc
 * est validé par le schéma correspondant à son `kind` avant tout enregistrement.
 * Les blocs EXERCISE et ASSIGNMENT sont introduits en phase 4.
 */

const richDoc = z.unknown().transform((value, ctx): RichNode => {
  try {
    return sanitizeRichDoc(value);
  } catch (err) {
    ctx.addIssue({ code: "custom", message: err instanceof RichTextError ? `richText:${err.message}` : "richText" });
    return z.NEVER;
  }
});

const shortText = (max: number) => z.string().trim().max(max);
const id = z.string().min(1).max(64);

export const CALLOUT_TONES = ["info", "tip", "warning", "culture", "grammar"] as const;

export const blockContentSchemas = {
  RICH_TEXT: z.object({ doc: richDoc }),
  CALLOUT: z.object({ tone: z.enum(CALLOUT_TONES), title: shortText(120).optional(), doc: richDoc }),
  VIDEO: z.object({ caption: shortText(300).optional() }),
  AUDIO: z.object({ mediaId: id, caption: shortText(300).optional(), transcript: shortText(10_000).optional() }),
  IMAGE: z.object({ mediaId: id, alt: z.string().trim().min(1, "altRequired").max(300), caption: shortText(300).optional() }),
  // Document à télécharger : PowerPoint, Word, PDF, Excel
  DOCUMENT: z.object({ mediaId: id, title: z.string().trim().min(1, "titleRequired").max(200), description: shortText(500).optional() }),
  VOCAB_LIST: z.object({
    title: shortText(120).optional(),
    items: z
      .array(
        z.object({
          term: z.string().trim().min(1).max(120),
          translation: z.string().trim().min(1).max(200),
          partOfSpeech: shortText(40).optional(),
          example: shortText(300).optional(),
        }),
      )
      .min(1)
      .max(60),
  }),
} as const;

export type EditableBlockKind = keyof typeof blockContentSchemas;
export const EDITABLE_BLOCK_KINDS = Object.keys(blockContentSchemas) as EditableBlockKind[];

export type BlockContent<K extends EditableBlockKind> = z.output<(typeof blockContentSchemas)[K]>;

export type RenderableBlock =
  | { id: string; kind: "RICH_TEXT"; content: BlockContent<"RICH_TEXT"> }
  | { id: string; kind: "CALLOUT"; content: BlockContent<"CALLOUT"> }
  | { id: string; kind: "VIDEO"; content: BlockContent<"VIDEO">; videoId: string | null }
  | { id: string; kind: "AUDIO"; content: BlockContent<"AUDIO"> }
  | { id: string; kind: "IMAGE"; content: BlockContent<"IMAGE"> }
  | { id: string; kind: "DOCUMENT"; content: BlockContent<"DOCUMENT"> }
  | { id: string; kind: "VOCAB_LIST"; content: BlockContent<"VOCAB_LIST"> };

/**
 * Relit un bloc stocké en base. Un contenu devenu invalide (édition manuelle, ancienne version)
 * est ignoré plutôt que rendu : on ne fait jamais confiance au JSON stocké.
 */
export function parseStoredBlock(row: { id: string; kind: string; content: unknown; videoId: string | null }): RenderableBlock | null {
  if (!(row.kind in blockContentSchemas)) return null;
  const kind = row.kind as EditableBlockKind;
  const parsed = blockContentSchemas[kind].safeParse(row.content);
  if (!parsed.success) return null;
  return { id: row.id, kind, content: parsed.data, ...(kind === "VIDEO" ? { videoId: row.videoId } : {}) } as RenderableBlock;
}

export function defaultBlockContent(kind: EditableBlockKind): unknown {
  const emptyDoc = { type: "doc", content: [{ type: "paragraph" }] };
  switch (kind) {
    case "RICH_TEXT":
      return { doc: emptyDoc };
    case "CALLOUT":
      return { tone: "tip", title: "", doc: emptyDoc };
    case "VIDEO":
      return { caption: "" };
    case "VOCAB_LIST":
      return { title: "", items: [{ term: "", translation: "" }] };
    default:
      return {};
  }
}
