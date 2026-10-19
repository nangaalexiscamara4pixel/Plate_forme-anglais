import type { BlockKind, LessonType, PublishStatus } from "@/generated/prisma/client";
import { slugify, uniqueSlug } from "@/lib/slug";
import { audit, type AuditContext } from "@/server/audit";
import { db } from "@/server/db";
import { blockContentSchemas, defaultBlockContent, type EditableBlockKind } from "./blocks";

/**
 * Opérations du CMS. L'appelant DOIT avoir vérifié le rôle administrateur (assertAdmin).
 * Chaque création, modification, suppression ou réorganisation est journalisée.
 */

export class ContentError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "PUBLISH_DATE_REQUIRED"
      | "PUBLISH_DATE_PAST"
      | "INVALID_ORDER"
      | "INVALID_CONTENT"
      | "VIDEO_NOT_FOUND",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

export type PublicationInput = { status: PublishStatus; publishAt?: Date | null };

function checkPublication(p: PublicationInput, now = new Date()) {
  if (p.status !== "SCHEDULED") return { status: p.status, publishAt: p.status === "PUBLISHED" ? (p.publishAt ?? now) : null };
  if (!p.publishAt) throw new ContentError("PUBLISH_DATE_REQUIRED");
  if (p.publishAt <= now) throw new ContentError("PUBLISH_DATE_PAST");
  return { status: p.status, publishAt: p.publishAt };
}

// ── Unités ───────────────────────────────────────────────────────────────────

export async function createUnit(actor: AuditContext, input: { moduleId: string; title: string; summary?: string }) {
  const mod = await db.module.findUnique({ where: { id: input.moduleId }, select: { id: true, units: { select: { slug: true, order: true } } } });
  if (!mod) throw new ContentError("NOT_FOUND");
  const unit = await db.unit.create({
    data: {
      moduleId: mod.id,
      title: input.title,
      summary: input.summary || null,
      slug: uniqueSlug(slugify(input.title), mod.units.map((u) => u.slug)),
      order: Math.max(0, ...mod.units.map((u) => u.order)) + 1,
      // Une unité n'est qu'un regroupement : visible d'office. Ce sont les leçons qui se publient.
      status: "PUBLISHED",
      publishAt: new Date(),
    },
  });
  await audit(actor, "content.unit.create", { type: "unit", id: unit.id }, { title: unit.title });
  return unit;
}

export async function updateUnit(
  actor: AuditContext,
  id: string,
  input: { title: string; summary?: string } & PublicationInput,
) {
  const unit = await db.unit.findUnique({ where: { id }, select: { id: true, moduleId: true, title: true, slug: true } });
  if (!unit) throw new ContentError("NOT_FOUND");
  const publication = checkPublication(input);
  let slug = unit.slug;
  if (input.title !== unit.title) {
    const siblings = await db.unit.findMany({ where: { moduleId: unit.moduleId, id: { not: id } }, select: { slug: true } });
    slug = uniqueSlug(slugify(input.title), siblings.map((s) => s.slug));
  }
  const updated = await db.unit.update({
    where: { id },
    data: { title: input.title, summary: input.summary || null, slug, ...publication },
  });
  await audit(actor, "content.unit.update", { type: "unit", id }, { status: updated.status });
  return updated;
}

export async function deleteUnit(actor: AuditContext, id: string) {
  const unit = await db.unit.delete({ where: { id } }).catch(() => null);
  if (!unit) throw new ContentError("NOT_FOUND");
  await audit(actor, "content.unit.delete", { type: "unit", id }, { title: unit.title });
}

// ── Leçons ───────────────────────────────────────────────────────────────────

export async function createLesson(actor: AuditContext, input: { unitId: string; title: string; type: LessonType }) {
  const unit = await db.unit.findUnique({ where: { id: input.unitId }, select: { id: true, lessons: { select: { slug: true, order: true } } } });
  if (!unit) throw new ContentError("NOT_FOUND");
  const lesson = await db.lesson.create({
    data: {
      unitId: unit.id,
      title: input.title,
      type: input.type,
      slug: uniqueSlug(slugify(input.title), unit.lessons.map((l) => l.slug)),
      order: Math.max(0, ...unit.lessons.map((l) => l.order)) + 1,
      // Une leçon commence avec un bloc adapté à son type.
      blocks: {
        create:
          input.type === "VIDEO"
            ? [{ order: 1, kind: "VIDEO", content: defaultBlockContent("VIDEO") as object }]
            : [{ order: 1, kind: "RICH_TEXT", content: defaultBlockContent("RICH_TEXT") as object }],
      },
    },
  });
  await audit(actor, "content.lesson.create", { type: "lesson", id: lesson.id }, { title: lesson.title });
  return lesson;
}

export async function updateLesson(
  actor: AuditContext,
  id: string,
  input: { title: string; summary?: string; type: LessonType; estimatedMinutes: number; xpReward: number } & PublicationInput,
) {
  const lesson = await db.lesson.findUnique({ where: { id }, select: { id: true, unitId: true, title: true, slug: true } });
  if (!lesson) throw new ContentError("NOT_FOUND");
  const publication = checkPublication(input);
  let slug = lesson.slug;
  if (input.title !== lesson.title) {
    const siblings = await db.lesson.findMany({ where: { unitId: lesson.unitId, id: { not: id } }, select: { slug: true } });
    slug = uniqueSlug(slugify(input.title), siblings.map((s) => s.slug));
  }
  const updated = await db.lesson.update({
    where: { id },
    data: {
      title: input.title,
      summary: input.summary || null,
      type: input.type,
      estimatedMinutes: input.estimatedMinutes,
      xpReward: input.xpReward,
      slug,
      ...publication,
    },
  });
  // Publier une leçon rend aussi visible son unité si elle était restée en brouillon :
  // sinon la leçon resterait invisible pour les étudiants.
  if (updated.status === "PUBLISHED" || updated.status === "SCHEDULED") {
    await db.unit.updateMany({ where: { id: lesson.unitId, status: "DRAFT" }, data: { status: "PUBLISHED", publishAt: new Date() } });
  }
  await audit(actor, "content.lesson.update", { type: "lesson", id }, { status: updated.status });
  return updated;
}

export async function deleteLesson(actor: AuditContext, id: string) {
  const lesson = await db.lesson.delete({ where: { id } }).catch(() => null);
  if (!lesson) throw new ContentError("NOT_FOUND");
  await audit(actor, "content.lesson.delete", { type: "lesson", id }, { title: lesson.title });
}

// ── Réorganisation ───────────────────────────────────────────────────────────

/**
 * Applique un nouvel ordre. La liste doit contenir EXACTEMENT les éléments du parent :
 * on ne peut ni déplacer un élément d'un autre parent, ni en omettre un.
 */
export async function reorder(actor: AuditContext, scope: "unit" | "lesson" | "block", parentId: string, orderedIds: string[]) {
  const current =
    scope === "unit"
      ? await db.unit.findMany({ where: { moduleId: parentId }, select: { id: true } })
      : scope === "lesson"
        ? await db.lesson.findMany({ where: { unitId: parentId }, select: { id: true } })
        : await db.lessonBlock.findMany({ where: { lessonId: parentId }, select: { id: true } });
  const expected = new Set(current.map((c) => c.id));
  if (orderedIds.length !== expected.size || !orderedIds.every((id) => expected.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
    throw new ContentError("INVALID_ORDER");
  }
  await db.$transaction(
    orderedIds.map((id, index) =>
      scope === "unit"
        ? db.unit.update({ where: { id }, data: { order: index + 1 } })
        : scope === "lesson"
          ? db.lesson.update({ where: { id }, data: { order: index + 1 } })
          : db.lessonBlock.update({ where: { id }, data: { order: index + 1 } }),
    ),
  );
  await audit(actor, "content.reorder", { type: scope, id: parentId }, { count: orderedIds.length });
}

// ── Blocs ────────────────────────────────────────────────────────────────────

export async function addBlock(actor: AuditContext, lessonId: string, kind: EditableBlockKind) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, blocks: { select: { order: true } } } });
  if (!lesson) throw new ContentError("NOT_FOUND");
  const block = await db.lessonBlock.create({
    data: {
      lessonId,
      kind: kind as BlockKind,
      order: Math.max(0, ...lesson.blocks.map((b) => b.order)) + 1,
      content: defaultBlockContent(kind) as object,
    },
  });
  await audit(actor, "content.block.update", { type: "lesson", id: lessonId }, { op: "add", kind });
  return block;
}

export async function saveBlock(actor: AuditContext, blockId: string, input: { content: unknown; videoId?: string | null }) {
  const block = await db.lessonBlock.findUnique({ where: { id: blockId }, select: { id: true, kind: true, lessonId: true } });
  if (!block || !(block.kind in blockContentSchemas)) throw new ContentError("NOT_FOUND");
  const parsed = blockContentSchemas[block.kind as EditableBlockKind].safeParse(input.content);
  if (!parsed.success) throw new ContentError("INVALID_CONTENT", parsed.error.issues.map((i) => i.message));

  let videoId: string | null | undefined;
  if (block.kind === "VIDEO") {
    videoId = input.videoId ?? null;
    if (videoId && !(await db.video.findUnique({ where: { id: videoId }, select: { id: true } }))) {
      throw new ContentError("VIDEO_NOT_FOUND");
    }
  }
  await db.lessonBlock.update({
    where: { id: blockId },
    data: { content: parsed.data as object, ...(videoId !== undefined ? { videoId } : {}) },
  });
  await audit(actor, "content.block.update", { type: "lesson", id: block.lessonId }, { op: "save", kind: block.kind });
}

export async function deleteBlock(actor: AuditContext, blockId: string) {
  const block = await db.lessonBlock.delete({ where: { id: blockId } }).catch(() => null);
  if (!block) throw new ContentError("NOT_FOUND");
  await audit(actor, "content.block.update", { type: "lesson", id: block.lessonId }, { op: "delete", kind: block.kind });
}
