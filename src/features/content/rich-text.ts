/**
 * Format du texte riche (JSON ProseMirror produit par TipTap) — validation par LISTE BLANCHE.
 *
 * Le contenu n'est jamais stocké ni rendu comme du HTML : il est validé ici, nettoyé
 * (attributs inconnus supprimés), puis rendu en éléments React par <RichText />. Toute
 * balise, tout attribut ou tout schéma d'URL non prévu est simplement rejeté : une
 * injection de script (XSS) est impossible par construction.
 */

export const NODE_TYPES = [
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "horizontalRule",
  "text",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
] as const;
export const MARK_TYPES = ["bold", "italic", "underline", "strike", "code", "link", "highlight"] as const;

export type NodeType = (typeof NODE_TYPES)[number];
export type MarkType = (typeof MARK_TYPES)[number];

export type RichMark = { type: MarkType; attrs?: { href?: string } };
export type RichNode = {
  type: NodeType;
  attrs?: { level?: number; start?: number; colspan?: number; rowspan?: number };
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
};

const LIMITS = { depth: 12, nodes: 5000, textLength: 20_000 };

export class RichTextError extends Error {}

/** Seuls http(s) et mailto sont autorisés ; `javascript:`, `data:`, etc. sont refusés. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string" || href.length > 2048) return null;
  const trimmed = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : null;
}

const intIn = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;

/** Valide et nettoie un document. Lève RichTextError si la structure est invalide. */
export function sanitizeRichDoc(input: unknown): RichNode {
  let count = 0;

  const visit = (raw: unknown, depth: number): RichNode => {
    if (depth > LIMITS.depth) throw new RichTextError("depth");
    if (++count > LIMITS.nodes) throw new RichTextError("size");
    if (!raw || typeof raw !== "object") throw new RichTextError("node");
    const node = raw as Record<string, unknown>;
    const type = node.type as NodeType;
    if (!NODE_TYPES.includes(type)) throw new RichTextError(`type:${String(node.type)}`);

    if (type === "text") {
      if (typeof node.text !== "string" || node.text.length === 0 || node.text.length > LIMITS.textLength) {
        throw new RichTextError("text");
      }
      const marks: RichMark[] = [];
      for (const m of Array.isArray(node.marks) ? node.marks : []) {
        const mark = m as { type?: string; attrs?: { href?: unknown } };
        if (!MARK_TYPES.includes(mark.type as MarkType)) continue; // marque inconnue : ignorée
        if (mark.type === "link") {
          const href = safeHref(mark.attrs?.href);
          if (href) marks.push({ type: "link", attrs: { href } });
          continue;
        }
        marks.push({ type: mark.type as MarkType });
      }
      return marks.length ? { type, text: node.text, marks } : { type, text: node.text };
    }

    const attrs: RichNode["attrs"] = {};
    const rawAttrs = (node.attrs ?? {}) as Record<string, unknown>;
    if (type === "heading") attrs.level = intIn(rawAttrs.level, 2, 4) ?? 2;
    if (type === "orderedList") attrs.start = intIn(rawAttrs.start, 1, 1000) ?? 1;
    if (type === "tableCell" || type === "tableHeader") {
      attrs.colspan = intIn(rawAttrs.colspan, 1, 20) ?? 1;
      attrs.rowspan = intIn(rawAttrs.rowspan, 1, 50) ?? 1;
    }

    const children = Array.isArray(node.content) ? node.content.map((c) => visit(c, depth + 1)) : undefined;
    const out: RichNode = { type };
    if (Object.keys(attrs).length) out.attrs = attrs;
    if (children?.length) out.content = children;
    return out;
  };

  const doc = visit(input, 0);
  if (doc.type !== "doc") throw new RichTextError("root");
  return doc;
}

export const EMPTY_DOC: RichNode = { type: "doc", content: [{ type: "paragraph" }] };

/** Texte brut d'un document (aperçus, recherche, estimation de durée). */
export function plainText(node: RichNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join(node.type === "doc" ? "\n" : " ");
}

/** Petit constructeur de documents, utilisé par le seed et les tests. */
export const rt = {
  doc: (...content: RichNode[]): RichNode => ({ type: "doc", content }),
  p: (...parts: (string | RichNode)[]): RichNode => ({
    type: "paragraph",
    content: parts.map((p) => (typeof p === "string" ? { type: "text" as const, text: p } : p)),
  }),
  h: (level: 2 | 3 | 4, text: string): RichNode => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] }),
  b: (text: string): RichNode => ({ type: "text", text, marks: [{ type: "bold" }] }),
  i: (text: string): RichNode => ({ type: "text", text, marks: [{ type: "italic" }] }),
  ul: (...items: string[]): RichNode => ({
    type: "bulletList",
    content: items.map((t) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] })),
  }),
  table: (header: string[], rows: string[][]): RichNode => ({
    type: "table",
    content: [
      { type: "tableRow", content: header.map((c) => ({ type: "tableHeader", content: [rt.p(c)] })) },
      ...rows.map((r) => ({ type: "tableRow" as const, content: r.map((c) => ({ type: "tableCell" as const, content: [rt.p(c)] })) })),
    ],
  }),
};
