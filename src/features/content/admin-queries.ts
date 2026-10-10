import "server-only";
import type { LevelCode, SkillCode } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { isLive } from "./access";

/** Lectures du CMS — réservées aux administrateurs (requireAdmin chez l'appelant). Tous statuts confondus. */

export async function getContentOverview() {
  const levels = await db.level.findMany({
    orderBy: { order: "asc" },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { units: { select: { status: true, publishAt: true, _count: { select: { lessons: true } } } } },
      },
    },
  });
  return levels.map((l) => ({
    ...l,
    modules: l.modules.map((m) => ({
      id: m.id,
      skill: m.skill,
      units: m.units.length,
      liveUnits: m.units.filter((u) => isLive(u)).length,
      lessons: m.units.reduce((a, u) => a + u._count.lessons, 0),
    })),
  }));
}

export async function getModuleTree(code: LevelCode, skill: SkillCode) {
  const level = await db.level.findUnique({ where: { code } });
  if (!level) return null;
  const mod = await db.module.findUnique({
    where: { levelId_skill: { levelId: level.id, skill } },
    include: {
      units: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, slug: true, type: true, status: true, publishAt: true, _count: { select: { blocks: true } } },
          },
        },
      },
    },
  });
  return mod ? { level, module: mod } : null;
}

export async function getLessonEditor(id: string) {
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: "asc" } },
      unit: { include: { module: { include: { level: true } } } },
    },
  });
  if (!lesson) return null;
  const mediaIds = lesson.blocks
    .map((b) => (b.content as { mediaId?: unknown } | null)?.mediaId)
    .filter((v): v is string => typeof v === "string");
  const [videos, media] = await Promise.all([
    db.video.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, status: true, provider: true, durationSec: true } }),
    mediaIds.length ? db.mediaFile.findMany({ where: { id: { in: mediaIds } }, select: { id: true, originalName: true, mime: true } }) : [],
  ]);
  return { lesson, videos, media };
}

export async function getMediaLibrary() {
  const [videos, files] = await Promise.all([
    db.video.findMany({
      orderBy: { createdAt: "desc" },
      include: { tracks: { select: { lang: true } }, _count: { select: { blocks: true } } },
    }),
    db.mediaFile.findMany({
      where: { uploadedAt: { not: null }, purpose: { in: ["LESSON_AUDIO", "LESSON_IMAGE", "LESSON_DOCUMENT"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return { videos, files };
}

export async function getVideoEditor(id: string) {
  return db.video.findUnique({ where: { id }, include: { tracks: true, mediaFile: { select: { originalName: true, sizeBytes: true } } } });
}
