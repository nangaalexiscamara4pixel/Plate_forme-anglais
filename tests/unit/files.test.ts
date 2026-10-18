import { describe, expect, it } from "vitest";
import { MEDIA_POLICY, matchesSignature, mimeFromName, safeBaseName } from "@/features/media/policy";
import { fileKind } from "@/lib/files";

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

describe("fichiers : types acceptés", () => {
  it("documents de cours : PowerPoint, Word, Excel et PDF ; images : avec GIF", () => {
    expect(MEDIA_POLICY.LESSON_DOCUMENT.mimes).toEqual(expect.arrayContaining(["application/pdf", PPTX, DOCX, "application/vnd.ms-powerpoint"]));
    expect(MEDIA_POLICY.LESSON_IMAGE.mimes).toContain("image/gif");
    expect(MEDIA_POLICY.SUBMISSION_FILE.mimes).toEqual(expect.arrayContaining([DOCX, "application/pdf", "image/png"]));
  });
  it("vérifie le contenu réel : un faux PowerPoint est refusé", () => {
    expect(matchesSignature(PPTX, ZIP)).toBe(true);
    expect(matchesSignature("application/vnd.ms-powerpoint", OLE)).toBe(true);
    expect(matchesSignature(PPTX, Buffer.from("<html><script>"))).toBe(false);
    expect(matchesSignature(DOCX, OLE)).toBe(false);
    expect(matchesSignature("image/gif", Buffer.from("GIF89a"))).toBe(true);
  });
  it("devine le type d'après l'extension (Office sous Windows)", () => {
    expect(mimeFromName("Cours 1.PPTX")).toBe(PPTX);
    expect(mimeFromName("devoir.docx")).toBe(DOCX);
    expect(mimeFromName("photo.jpeg")).toBe("image/jpeg");
    expect(mimeFromName("script.exe")).toBeUndefined();
  });
  it("nom de stockage lisible et sûr (accents, espaces, tentative de chemin)", () => {
    expect(safeBaseName("Cours de grammaire (été) v2.pptx")).toBe("Cours-de-grammaire-ete-v2");
    expect(safeBaseName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeBaseName("???.pdf")).toBe("fichier");
  });
  it("classe les fichiers pour l'affichage", () => {
    expect(fileKind(PPTX)).toBe("slides");
    expect(fileKind(DOCX)).toBe("word");
    expect(fileKind("application/pdf")).toBe("pdf");
    expect(fileKind("image/png")).toBe("image");
  });
});
