import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { learnerScope, studentCanAccessMedia, studentCanAccessVideo } from "@/features/content/access";
import { rt } from "@/features/content/rich-text";
import { createLesson, createUnit, reorder, saveBlock, updateLesson, updateUnit } from "@/features/content/service";
import { getLessonView, getLevelOverview, getModuleView } from "@/features/learn/queries";
import { confirmUpload, requestUpload } from "@/features/media/service";
import { db } from "@/server/db";
import { localPath } from "@/server/storage";
import { createUser, resetDb, seedLevels } from "../support/db";

/**
 * Isolation des contenus : niveau, publication, médias. Toutes les lectures étudiantes
 * passent par learnerScope + accessibleLessonWhere.
 */
describe("contenus pédagogiques : accès et CMS", () => {
  let levels: Awaited<ReturnType<typeof seedLevels>>;
  let adminId: string;
  const actor = () => ({ actorId: adminId });
  const lvl = (code: string) => levels.find((l) => l.code === code)!;

  async function moduleOf(code: string, skill: "READING" | "LISTENING" = "READING") {
    return db.module.create({ data: { levelId: lvl(code).id, skill, title: skill, order: 1 } });
  }

  /** Crée une unité + une leçon publiées, avec un bloc audio référençant `mediaId`. */
  async function publishedLesson(code: string, opts: { mediaId?: string; videoId?: string } = {}) {
    const mod = (await db.module.findFirst({ where: { levelId: lvl(code).id, skill: "READING" } })) ?? (await moduleOf(code));
    const unit = await createUnit(actor(), { moduleId: mod.id, title: `Unit ${code}` });
    await updateUnit(actor(), unit.id, { title: unit.title, status: "PUBLISHED" });
    const lesson = await createLesson(actor(), { unitId: unit.id, title: `Lesson ${code}`, type: "TEXT" });
    await updateLesson(actor(), lesson.id, { title: lesson.title, type: "TEXT", estimatedMinutes: 5, xpReward: 10, status: "PUBLISHED" });
    if (opts.mediaId) await db.lessonBlock.create({ data: { lessonId: lesson.id, order: 9, kind: "AUDIO", content: { mediaId: opts.mediaId } } });
    if (opts.videoId) await db.lessonBlock.create({ data: { lessonId: lesson.id, order: 10, kind: "VIDEO", content: {}, videoId: opts.videoId } });
    return { mod, unit: await db.unit.findUniqueOrThrow({ where: { id: unit.id } }), lesson: await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } }) };
  }

  beforeEach(async () => {
    await resetDb();
    levels = await seedLevels();
    adminId = (await createUser({ role: "ADMIN", status: "APPROVED" })).id;
  });

  it("un étudiant A1 voit sa leçon A1 mais jamais une leçon B1 (même avec l'URL exacte)", async () => {
    const a1 = await publishedLesson("A1");
    const b1 = await publishedLesson("B1");
    const student = await createUser({ status: "APPROVED", currentLevelId: lvl("A1").id });

    expect(await getLessonView(student.id, "A1", "READING", a1.unit.slug, a1.lesson.slug)).not.toBeNull();
    expect(await getLessonView(student.id, "B1", "READING", b1.unit.slug, b1.lesson.slug)).toBeNull();
    expect(await getLevelOverview(student.id, "B1")).toBeNull();
    expect(await getModuleView(student.id, "B1", "READING")).toBeNull();
  });

  it("les brouillons, archives et publications futures sont invisibles ; une publication programmée passée est visible", async () => {
    const { unit, lesson } = await publishedLesson("A1");
    const student = await createUser({ status: "APPROVED", currentLevelId: lvl("A1").id });
    const view = () => getLessonView(student.id, "A1", "READING", unit.slug, lesson.slug);

    await db.lesson.update({ where: { id: lesson.id }, data: { status: "DRAFT" } });
    expect(await view()).toBeNull();
    await db.lesson.update({ where: { id: lesson.id }, data: { status: "ARCHIVED" } });
    expect(await view()).toBeNull();
    await db.lesson.update({ where: { id: lesson.id }, data: { status: "SCHEDULED", publishAt: new Date(Date.now() + 3_600_000) } });
    expect(await view()).toBeNull();
    await db.lesson.update({ where: { id: lesson.id }, data: { status: "SCHEDULED", publishAt: new Date(Date.now() - 1000) } });
    expect(await view()).not.toBeNull();

    // Une unité non publiée masque toutes ses leçons
    await db.unit.update({ where: { id: unit.id }, data: { status: "DRAFT" } });
    expect(await view()).toBeNull();
  });

  it("niveaux inférieurs : accessibles seulement s'ils sont validés ET si le réglage est actif", async () => {
    const a1 = await publishedLesson("A1");
    const student = await createUser({ status: "APPROVED", currentLevelId: lvl("A2").id });
    const view = () => getLessonView(student.id, "A1", "READING", a1.unit.slug, a1.lesson.slug);

    expect(await view()).toBeNull(); // A1 jamais validé
    await db.levelEnrollment.create({ data: { userId: student.id, levelId: lvl("A1").id, status: "COMPLETED" } });
    expect(await view()).not.toBeNull();
    await db.platformSetting.create({ data: { key: "access.lowerLevelsAccessible", value: false } });
    expect(await view()).toBeNull();

    // Un niveau SUPÉRIEUR « validé » (incohérence de données) ne donne jamais accès
    await db.platformSetting.update({ where: { key: "access.lowerLevelsAccessible" }, data: { value: true } });
    const b1 = await publishedLesson("B1");
    await db.levelEnrollment.create({ data: { userId: student.id, levelId: lvl("B1").id, status: "COMPLETED" } });
    expect(await getLessonView(student.id, "B1", "READING", b1.unit.slug, b1.lesson.slug)).toBeNull();
  });

  it("un fichier ou une vidéo n'est accessible que via une leçon autorisée", async () => {
    const audio = await db.mediaFile.create({ data: { key: "lesson_audio/t/a.mp3", mime: "audio/mpeg", sizeBytes: 3, purpose: "LESSON_AUDIO", uploadedAt: new Date() } });
    const orphan = await db.mediaFile.create({ data: { key: "lesson_audio/t/b.mp3", mime: "audio/mpeg", sizeBytes: 3, purpose: "LESSON_AUDIO", uploadedAt: new Date() } });
    const video = await db.video.create({ data: { title: "v", provider: "LOCAL", status: "READY" } });
    await publishedLesson("B1", { mediaId: audio.id, videoId: video.id });

    const a1 = await createUser({ status: "APPROVED", currentLevelId: lvl("A1").id });
    const b1 = await createUser({ status: "APPROVED", currentLevelId: lvl("B1").id });
    const pending = await createUser({ status: "PENDING" });

    expect(await studentCanAccessMedia(await learnerScope(b1.id), audio.id)).toBe(true);
    expect(await studentCanAccessVideo(await learnerScope(b1.id), video.id)).toBe(true);
    expect(await studentCanAccessMedia(await learnerScope(a1.id), audio.id)).toBe(false);
    expect(await studentCanAccessVideo(await learnerScope(a1.id), video.id)).toBe(false);
    expect(await studentCanAccessMedia(await learnerScope(b1.id), orphan.id)).toBe(false);
    expect(await studentCanAccessMedia(await learnerScope(pending.id), audio.id)).toBe(false);
  });

  it("réordonnancement : impossible d'inclure un élément d'un autre parent ou d'en omettre un", async () => {
    const m = await moduleOf("A1");
    const other = await moduleOf("A2");
    const u1 = await createUnit(actor(), { moduleId: m.id, title: "Un" });
    const u2 = await createUnit(actor(), { moduleId: m.id, title: "Deux" });
    const foreign = await createUnit(actor(), { moduleId: other.id, title: "Ailleurs" });

    await reorder(actor(), "unit", m.id, [u2.id, u1.id]);
    expect((await db.unit.findMany({ where: { moduleId: m.id }, orderBy: { order: "asc" } })).map((u) => u.id)).toEqual([u2.id, u1.id]);
    await expect(reorder(actor(), "unit", m.id, [u2.id, foreign.id])).rejects.toMatchObject({ code: "INVALID_ORDER" });
    await expect(reorder(actor(), "unit", m.id, [u2.id])).rejects.toMatchObject({ code: "INVALID_ORDER" });
    await expect(reorder(actor(), "unit", m.id, [u2.id, u2.id])).rejects.toMatchObject({ code: "INVALID_ORDER" });
    expect((await db.unit.findUniqueOrThrow({ where: { id: foreign.id } })).moduleId).toBe(other.id);
  });

  it("publication programmée : date obligatoire et future", async () => {
    const m = await moduleOf("A1");
    const u = await createUnit(actor(), { moduleId: m.id, title: "Unité" });
    await expect(updateUnit(actor(), u.id, { title: "Unité", status: "SCHEDULED" })).rejects.toMatchObject({ code: "PUBLISH_DATE_REQUIRED" });
    await expect(updateUnit(actor(), u.id, { title: "Unité", status: "SCHEDULED", publishAt: new Date(Date.now() - 1000) })).rejects.toMatchObject({
      code: "PUBLISH_DATE_PAST",
    });
  });

  it("slugs uniques et enregistrement d'un bloc nettoyé (lien javascript: retiré)", async () => {
    const m = await moduleOf("A1");
    const a = await createUnit(actor(), { moduleId: m.id, title: "Les bases" });
    const b = await createUnit(actor(), { moduleId: m.id, title: "Les bases" });
    expect([a.slug, b.slug]).toEqual(["les-bases", "les-bases-2"]);

    const lesson = await createLesson(actor(), { unitId: a.id, title: "Intro", type: "TEXT" });
    const block = await db.lessonBlock.findFirstOrThrow({ where: { lessonId: lesson.id } });
    await saveBlock(actor(), block.id, {
      content: {
        doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] },
      },
    });
    const saved = await db.lessonBlock.findUniqueOrThrow({ where: { id: block.id } });
    expect(JSON.stringify(saved.content)).not.toContain("javascript");
    await expect(saveBlock(actor(), block.id, { content: { doc: { type: "doc", content: [{ type: "iframe" }] } } })).rejects.toMatchObject({
      code: "INVALID_CONTENT",
    });
    await saveBlock(actor(), block.id, { content: { doc: rt.doc(rt.p("Hello")) } });
  });

  it("upload : un fichier dont le contenu ne correspond pas au type annoncé est refusé et supprimé", async () => {
    const { mediaId } = await requestUpload(actor(), { purpose: "LESSON_IMAGE", mime: "image/png", size: 21, name: "evil.png" });
    const media = await db.mediaFile.findUniqueOrThrow({ where: { id: mediaId } });
    await mkdir(path.dirname(localPath(media.key)), { recursive: true });
    await writeFile(localPath(media.key), "<svg onload=alert(1)>"); // 21 octets, mais pas un PNG
    await expect(confirmUpload(actor(), mediaId)).rejects.toMatchObject({ code: "UPLOAD_MISMATCH" });
    expect(await db.mediaFile.count({ where: { id: mediaId } })).toBe(0);

    await expect(requestUpload(actor(), { purpose: "LESSON_IMAGE", mime: "image/svg+xml", size: 10, name: "a.svg" })).rejects.toMatchObject({
      code: "TYPE_NOT_ALLOWED",
    });
    await expect(requestUpload(actor(), { purpose: "LESSON_IMAGE", mime: "image/png", size: 50 * 1024 * 1024, name: "big.png" })).rejects.toMatchObject({
      code: "TOO_LARGE",
    });
  });
});
