import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * Règles d'accès au contenu pédagogique — appliquées dans TOUTES les lectures côté étudiant.
 *  1. Seuls les contenus « en ligne » sont visibles : publiés, ou programmés dont la date est passée.
 *  2. Un étudiant n'accède qu'à son niveau actuel, plus — si le réglage est actif — aux niveaux
 *     qu'il a validés (inscription COMPLETED). Jamais aux niveaux supérieurs.
 */

/** Filtre « en ligne » pour Unit / Lesson. La publication programmée ne nécessite aucune tâche planifiée. */
export function liveWhere(now = new Date()) {
  return {
    OR: [{ status: "PUBLISHED" as const }, { status: "SCHEDULED" as const, publishAt: { lte: now } }],
  } satisfies Prisma.UnitWhereInput & Prisma.LessonWhereInput;
}

export function isLive(item: { status: string; publishAt: Date | null }, now = new Date()) {
  return item.status === "PUBLISHED" || (item.status === "SCHEDULED" && !!item.publishAt && item.publishAt <= now);
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  return (row?.value as T | undefined) ?? fallback;
}

export type LearnerScope = {
  userId: string;
  currentLevelId: string | null;
  /** Identifiants des niveaux consultables, du plus bas au plus haut. */
  levelIds: string[];
};

/** Niveaux accessibles à un étudiant (calculés depuis la base, jamais depuis la requête). */
export async function learnerScope(userId: string): Promise<LearnerScope> {
  const [user, lowerLevelsAccessible] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        currentLevelId: true,
        enrollments: { where: { status: "COMPLETED" }, select: { levelId: true, level: { select: { order: true } } } },
        currentLevel: { select: { order: true } },
      },
    }),
    getSetting("access.lowerLevelsAccessible", true),
  ]);
  if (!user.currentLevelId || !user.currentLevel) return { userId, currentLevelId: null, levelIds: [] };
  const completedBelow = lowerLevelsAccessible
    ? user.enrollments.filter((e) => e.level.order < user.currentLevel!.order).sort((a, b) => a.level.order - b.level.order)
    : [];
  return {
    userId,
    currentLevelId: user.currentLevelId,
    levelIds: [...completedBelow.map((e) => e.levelId), user.currentLevelId],
  };
}

/** Condition Prisma : leçon en ligne, dans une unité en ligne, d'un niveau accessible. */
export function accessibleLessonWhere(scope: LearnerScope, now = new Date()): Prisma.LessonWhereInput {
  return {
    AND: [liveWhere(now), { unit: { AND: [liveWhere(now), { module: { levelId: { in: scope.levelIds } } }] } }],
  };
}

/**
 * Un fichier (audio, image, document) ou une vidéo n'est servi à un étudiant que s'il est
 * utilisé par une leçon qu'il peut consulter.
 */
export async function studentCanAccessMedia(scope: LearnerScope, mediaId: string): Promise<boolean> {
  if (scope.levelIds.length === 0) return false;
  const lesson = await db.lesson.findFirst({
    where: {
      ...accessibleLessonWhere(scope),
      blocks: { some: { content: { path: ["mediaId"], equals: mediaId } } },
    },
    select: { id: true },
  });
  return Boolean(lesson);
}

export async function studentCanAccessVideo(scope: LearnerScope, videoId: string): Promise<boolean> {
  if (scope.levelIds.length === 0) return false;
  const lesson = await db.lesson.findFirst({
    where: { ...accessibleLessonWhere(scope), blocks: { some: { videoId } } },
    select: { id: true },
  });
  return Boolean(lesson);
}
