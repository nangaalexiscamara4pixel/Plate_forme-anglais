"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accessibleLessonWhere, learnerScope } from "@/features/content/access";
import { createAction, fail } from "@/server/actions";
import { db } from "@/server/db";
import { assertApprovedStudent } from "@/server/dal/guards";

/**
 * Progression de l'étudiant. L'identifiant de l'utilisateur vient TOUJOURS de la session ;
 * la leçon doit faire partie de son périmètre (niveau accessible, contenu publié).
 * Bloqué en mode « voir en tant que » (lecture seule).
 */
async function accessibleLesson(lessonId: string) {
  const viewer = await assertApprovedStudent({ mutation: true });
  const scope = await learnerScope(viewer.userId);
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, ...accessibleLessonWhere(scope) }, select: { id: true } });
  return lesson ? { viewer, lesson } : null;
}

export const completeLessonAction = createAction(z.object({ lessonId: z.string().min(1).max(64) }), async ({ lessonId }) => {
  const found = await accessibleLesson(lessonId);
  if (!found) return fail("NOT_FOUND");
  const now = new Date();
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: found.viewer.userId, lessonId } },
    create: { userId: found.viewer.userId, lessonId, status: "COMPLETED", percent: 100, completedAt: now },
    update: { status: "COMPLETED", percent: 100, completedAt: now },
  });
  revalidatePath("/[locale]/app", "layout");
  return { ok: true };
});

/** Position de lecture vidéo (reprise là où l'étudiant s'était arrêté). */
export const saveVideoPositionAction = createAction(
  z.object({ lessonId: z.string().min(1).max(64), seconds: z.coerce.number().int().min(0).max(24 * 3600), percent: z.coerce.number().int().min(0).max(100) }),
  async ({ lessonId, seconds, percent }) => {
    const found = await accessibleLesson(lessonId);
    if (!found) return fail("NOT_FOUND");
    const existing = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: found.viewer.userId, lessonId } } });
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: found.viewer.userId, lessonId } },
      create: { userId: found.viewer.userId, lessonId, status: "IN_PROGRESS", percent, videoPositionSec: seconds },
      update: {
        videoPositionSec: seconds,
        // Une leçon terminée le reste ; sinon on conserve la meilleure progression atteinte.
        ...(existing?.status === "COMPLETED" ? {} : { status: "IN_PROGRESS", percent: Math.max(existing?.percent ?? 0, percent) }),
      },
    });
    return { ok: true };
  },
);
