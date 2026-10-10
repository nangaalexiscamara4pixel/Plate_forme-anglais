import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/rich-text";
import { blockContentSchemas, parseStoredBlock } from "@/features/content/blocks";
import { rt, RichTextError, sanitizeRichDoc } from "@/features/content/rich-text";
import { matchesSignature } from "@/features/media/policy";
import { parseChapters, parseSubtitles, toWebVtt } from "@/features/video/captions";
import { slugify, uniqueSlug } from "@/lib/slug";
import { localPath, signLocalToken, verifyLocalToken } from "@/server/storage";

const link = (href: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "clic", marks: [{ type: "link", attrs: { href } }] }] }] });

describe("texte riche : liste blanche anti-XSS", () => {
  it("supprime les liens javascript: et data:", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", " vbscript:x"]) {
      const doc = sanitizeRichDoc(link(href));
      expect(JSON.stringify(doc)).not.toContain("href");
    }
  });

  it("conserve les liens https et mailto", () => {
    expect(JSON.stringify(sanitizeRichDoc(link("https://example.com")))).toContain("https://example.com");
    expect(JSON.stringify(sanitizeRichDoc(link("mailto:a@b.c")))).toContain("mailto:a@b.c");
  });

  it("rejette les types de nœuds inconnus (iframe, image, script…)", () => {
    for (const type of ["iframe", "image", "script", "codeBlock", "html"]) {
      expect(() => sanitizeRichDoc({ type: "doc", content: [{ type }] })).toThrow(RichTextError);
    }
  });

  it("supprime les attributs non prévus et borne les niveaux de titre", () => {
    const doc = sanitizeRichDoc({
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1, onclick: "alert(1)", style: "x" }, content: [{ type: "text", text: "T" }] }],
    });
    expect(doc.content![0]!.attrs).toEqual({ level: 2 });
  });

  it("limite la profondeur d'imbrication", () => {
    let node: Record<string, unknown> = { type: "paragraph" };
    for (let i = 0; i < 20; i++) node = { type: "blockquote", content: [node] };
    expect(() => sanitizeRichDoc({ type: "doc", content: [node] })).toThrow(RichTextError);
  });

  it("le rendu échappe tout le texte (aucune balise injectée)", () => {
    const html = renderToStaticMarkup(createElement(RichText, { doc: rt.doc(rt.p("<script>alert(1)</script><img src=x onerror=alert(1)>")) }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("le rendu ignore un lien dangereux même s'il a été stocké", () => {
    const html = renderToStaticMarkup(
      createElement(RichText, {
        doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] },
      }),
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a");
  });
});

describe("blocs de leçon", () => {
  it("exige un texte alternatif pour les images", () => {
    expect(blockContentSchemas.IMAGE.safeParse({ mediaId: "m1", alt: "" }).success).toBe(false);
    expect(blockContentSchemas.IMAGE.safeParse({ mediaId: "m1", alt: "Une carte" }).success).toBe(true);
  });
  it("refuse une liste de vocabulaire vide ou incomplète", () => {
    expect(blockContentSchemas.VOCAB_LIST.safeParse({ items: [] }).success).toBe(false);
    expect(blockContentSchemas.VOCAB_LIST.safeParse({ items: [{ term: "hello", translation: "" }] }).success).toBe(false);
  });
  it("ignore au rendu un bloc stocké invalide plutôt que de l'afficher", () => {
    expect(parseStoredBlock({ id: "b", kind: "RICH_TEXT", content: { doc: { type: "iframe" } }, videoId: null })).toBeNull();
    expect(parseStoredBlock({ id: "b", kind: "EXERCISE", content: {}, videoId: null })).toBeNull();
  });
});

describe("sous-titres et chapitres", () => {
  it("analyse SRT et WebVTT, en retirant les balises", () => {
    const srt = "1\n00:00:01,000 --> 00:00:03,500\n<b>Hello</b> world\n\n2\n00:00:04,000 --> 00:00:05,000\nBye";
    expect(parseSubtitles(srt)).toEqual([
      { start: 1, end: 3.5, text: "Hello world" },
      { start: 4, end: 5, text: "Bye" },
    ]);
    expect(parseSubtitles("WEBVTT\n\n00:01.000 --> 00:02.000\nHi")).toEqual([{ start: 1, end: 2, text: "Hi" }]);
  });
  it("produit un WebVTT échappé", () => {
    const vtt = toWebVtt([{ start: 0, end: 1, text: "<script> & --> x" }]);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("&lt;script&gt; &amp; → x");
  });
  it("analyse les chapitres", () => {
    expect(parseChapters("0:00 Intro\n1:05:30 Fin\nbad line")).toEqual([
      { start: 0, title: "Intro" },
      { start: 3930, title: "Fin" },
    ]);
  });
});

describe("fichiers", () => {
  it("vérifie la signature binaire réelle", () => {
    expect(matchesSignature("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(matchesSignature("image/png", Buffer.from("<svg onload=alert(1)>"))).toBe(false);
    expect(matchesSignature("application/pdf", Buffer.from("%PDF-1.7"))).toBe(true);
    expect(matchesSignature("video/webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
    expect(matchesSignature("image/svg+xml", Buffer.from("<svg"))).toBe(false);
  });

  it("jetons de stockage local : signés, liés à l'opération, expirants", () => {
    const token = signLocalToken({ k: "a/b.png", op: "get", exp: Date.now() + 60_000 });
    expect(verifyLocalToken(token)).toMatchObject({ k: "a/b.png", op: "get" });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ k: "../../.env", op: "get", exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifyLocalToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyLocalToken(`${body}.AAAA`)).toBeNull();
    expect(verifyLocalToken(signLocalToken({ k: "x", op: "get", exp: Date.now() - 1 }))).toBeNull();
  });

  it("refuse toute clé qui sortirait du dossier de stockage", () => {
    expect(() => localPath("../../.env")).toThrow();
    expect(() => localPath("..\\secret")).toThrow();
    expect(localPath("lesson_image/2026/x.png")).toContain("lesson_image");
  });
});

describe("slugs", () => {
  it("translittère et dédoublonne", () => {
    expect(slugify("Les verbes irréguliers !")).toBe("les-verbes-irreguliers");
    expect(slugify("¿¿??")).toBe("item");
    expect(uniqueSlug("intro", ["intro", "intro-2"])).toBe("intro-3");
  });
});
