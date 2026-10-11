import "server-only";
import { learnerScope, studentCanAccessMedia, studentCanAccessVideo } from "@/features/content/access";
import { db } from "@/server/db";
import { decideAdminArea, decideStudentArea } from "@/server/dal/access";
import type { Viewer } from "@/server/dal/viewer";

/**
 * Droit de lecture d'un média par la personne connectée :
 *  - administrateur (2FA, session valide) : tout ;
 *  - étudiant approuvé (ou admin en impersonation) : les médias des leçons qu'il peut consulter, l'audio
 *    des exercices publiés de ses niveaux, et ses propres fichiers (enregistrements de devoirs).
 */
export async function canViewMedia(viewer: Viewer | null, target: { mediaId?: string; videoId?: string }): Promise<boolean> {
  if (!viewer) return false;
  if (decideAdminArea(viewer).allow) return true;
  if (!decideStudentArea(viewer).allow) return false;
  const scope = await learnerScope(viewer.userId);
  if (target.videoId) return studentCanAccessVideo(scope, target.videoId);
  if (target.mediaId) {
    if (await studentCanAccessMedia(scope, target.mediaId)) return true;
    const media = await db.mediaFile.findUnique({ where: { id: target.mediaId }, select: { ownerUserId: true } });
    if (media?.ownerUserId === viewer.userId) return true;
    return (
      (await db.question.count({
        where: { audioFileId: target.mediaId, exercise: { status: "PUBLISHED", levelId: { in: scope.levelIds } } },
      })) > 0
    );
  }
  return false;
}
