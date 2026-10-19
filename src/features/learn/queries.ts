import "server-only";
import type { LevelCode, SkillCode } from "@/generated/prisma/client";
import { accessibleLessonWhere, learnerScope, liveWhere, type LearnerScope } from "@/features/content/access";
import { parseStoredBlock, type RenderableBlock } from "@/features/content/blocks";
import type { Chapter } from "@/features/video/captions";
import { db } from "@/server/db";
import { playbackSource, type PlaybackSource } from "@/server/video";

/**
 * Lectures de l'espace étudiant. Toutes partent de `learnerScope(userId)` (calculé en base) :
 * un niveau, une unité ou une leçon hors de portée renvoie `null` → page 404.
 */

export const SKILL_ORDER: SkillCode[] = ["READING", "LISTENING", "SPEAKING", "WRITING"];

export function parseLevelParam(v: string): LevelCode | null {
  const up = v.toUpperCase();
  return (["A1", "A2", "B1", "B2"] as const).includes(up as LevelCode) ? (up as LevelCode) : null;
}
export function parseSkillParam(v: string): SkillCode | null {
  const up = v.toUpperCase();
  return (SKILL_ORDER as string[]).includes(up) ? (up as SkillCode) : null;
}

async function levelInScope(scope: LearnerScope, code: LevelCode) {
  const level = await db.level.findUnique({ where: { code } });
  return level && scope.levelIds.includes(level.id) ? level : null;
}

/** Niveaux consultables (pour le sélecteur de niveau). */
export async function getAccessibleLevels(userId: string) {
  const scope = await learnerScope(userId);
  const levels = await db.level.findMany({ where: { id: { in: scope.levelIds } }, orderBy: { order: "asc" } });
  return { scope, levels, current: levels.find((l) => l.id === scope.currentLevelId) ?? null };
}

/** Vue d'un niveau : les quatre compétences avec leur avancement. */
export async function getLevelOverview(userId: string, code: LevelCode) {
  const scope = await learnerScope(userId);
  const level = await levelInScope(scope, code);
  if (!level) return null;
  const modules = await db.module.findMany({ where: { levelId: level.id }, orderBy: { order: "asc" } });
  const lessons = await db.lesson.findMany({
    where: { ...accessibleLessonWhere(scope), unit: { ...liveWhere(), moduleId: { in: modules.map((m) => m.id) } } },
    select: { id: true, unit: { select: { moduleId: true } }, progress: { where: { userId }, select: { status: true } } },
  });
  return {
    level,
    isCurrent: level.id === scope.currentLevelId,
    modules: modules
      .sort((a, b) => SKILL_ORDER.indexOf(a.skill) - SKILL_ORDER.indexOf(b.skill))
      .map((m) => {
        const own = lessons.filter((l) => l.unit.moduleId === m.id);
        return {
          ...m,
          lessonCount: own.length,
          completedCount: own.filter((l) => l.progress[0]?.status === "COMPLETED").length,
        };
      }),
  };
}

/** Vue d'une compétence : unités et leçons en ligne, avec statut de progression. */
export async function getModuleView(userId: string, code: LevelCode, skill: SkillCode) {
  const scope = await learnerScope(userId);
  const level = await levelInScope(scope, code);
  if (!level) return null;
  const mod = await db.module.findUnique({
    where: { levelId_skill: { levelId: level.id, skill } },
    include: {
      units: {
        where: liveWhere(),
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: liveWhere(),
            orderBy: { order: "asc" },
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              type: true,
              estimatedMinutes: true,
              progress: { where: { userId }, select: { status: true, percent: true } },
            },
          },
        },
      },
    },
  });
  if (!mod) return null;
  return { level, module: mod };
}

export type LessonVideoData = {
  id: string;
  title: string;
  chapters: Chapter[];
  captions: string[];
  source: PlaybackSource;
};

export type LessonContent = {
  blocks: RenderableBlock[];
  videos: Record<string, LessonVideoData>;
};

/** Transforme les blocs stockés en blocs affichables + sources vidéo signées. */
/** Dernières leçons mises en ligne pour l'étudiant (tableau de bord), avec leur état de progression. */
export async function getRecentLessons(userId: string, take = 6) {
  const scope = await learnerScope(userId);
  if (scope.levelIds.length === 0) return [];
  const lessons = await db.lesson.findMany({
    where: accessibleLessonWhere(scope),
    orderBy: [{ publishAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    take,
    select: {
      id: true,
      slug: true,
      title: true,
      estimatedMinutes: true,
      publishAt: true,
      unit: { select: { slug: true, title: true, module: { select: { skill: true, level: { select: { code: true } } } } } },
      progress: { where: { userId }, select: { status: true } },
    },
  });
  return lessons.map((l) => ({
    id: l.id,
    title: l.title,
    unitTitle: l.unit.title,
    minutes: l.estimatedMinutes,
    publishAt: l.publishAt,
    skill: l.unit.module.skill,
    levelCode: l.unit.module.level.code,
    unitSlug: l.unit.slug,
    lessonSlug: l.slug,
    completed: l.progress[0]?.status === "COMPLETED",
  }));
}

export async function loadLessonContent(blocks: { id: string; kind: string; content: unknown; videoId: string | null }[]): Promise<LessonContent> {
  const rendered = blocks.map(parseStoredBlock).filter((b): b is RenderableBlock => b !== null);
  const videoIds = rendered.flatMap((b) => (b.kind === "VIDEO" && b.videoId ? [b.videoId] : []));
  const videos = videoIds.length
    ? await db.video.findMany({ where: { id: { in: videoIds } }, include: { tracks: { select: { lang: true, kind: true } } } })
    : [];
  const entries = await Promise.all(
    videos.map(async (v): Promise<[string, LessonVideoData]> => [
      v.id,
      {
        id: v.id,
        title: v.title,
        chapters: (v.chapters as Chapter[] | null) ?? [],
        captions: v.tracks.filter((t) => t.kind === "SUBTITLES").map((t) => t.lang),
        source: await playbackSource(v),
      },
    ]),
  );
  return { blocks: rendered, videos: Object.fromEntries(entries) };
}

/**
 * Marque une leçon « en cours » à la première ouverture. Fonction serveur interne (PAS une
 * Server Action) : appelée par la page après chargement d'une leçon déjà autorisée.
 */
export async function touchLesson(userId: string, lessonId: string) {
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, status: "IN_PROGRESS", percent: 0 },
    update: {},
  });
}

/** Une leçon accessible, avec sa navigation (précédente / suivante dans la compétence). */
export async function getLessonView(userId: string, code: LevelCode, skill: SkillCode, unitSlug: string, lessonSlug: string) {
  const view = await getModuleView(userId, code, skill);
  if (!view) return null;
  const unit = view.module.units.find((u) => u.slug === unitSlug);
  const summary = unit?.lessons.find((l) => l.slug === lessonSlug);
  if (!unit || !summary) return null;

  const scope = await learnerScope(userId);
  const lesson = await db.lesson.findFirst({
    where: { id: summary.id, ...accessibleLessonWhere(scope) },
    include: { blocks: { orderBy: { order: "asc" } }, progress: { where: { userId } } },
  });
  if (!lesson) return null;

  const flat = view.module.units.flatMap((u) => u.lessons.map((l) => ({ unitSlug: u.slug, unitTitle: u.title, ...l })));
  const index = flat.findIndex((l) => l.id === lesson.id);
  return {
    level: view.level,
    skill,
    unit,
    lesson,
    progress: lesson.progress[0] ?? null,
    content: await loadLessonContent(lesson.blocks),
    previous: index > 0 ? flat[index - 1]! : null,
    next: index < flat.length - 1 ? flat[index + 1]! : null,
    position: { index: index + 1, total: flat.length },
  };
}
