import "server-only";
import { learnerScope, studentCanAccessMedia, studentCanAccessVideo } from "@/features/content/access";
import { decideAdminArea, decideStudentArea } from "@/server/dal/access";
import type { Viewer } from "@/server/dal/viewer";

/**
 * Droit de lecture d'un média par la personne connectée :
 *  - administrateur (2FA, session valide) : tout ;
 *  - étudiant approuvé (ou admin en impersonation) : uniquement les médias des leçons qu'il peut consulter.
 */
export async function canViewMedia(viewer: Viewer | null, target: { mediaId?: string; videoId?: string }): Promise<boolean> {
  if (!viewer) return false;
  if (decideAdminArea(viewer).allow) return true;
  if (!decideStudentArea(viewer).allow) return false;
  const scope = await learnerScope(viewer.userId);
  if (target.videoId) return studentCanAccessVideo(scope, target.videoId);
  if (target.mediaId) return studentCanAccessMedia(scope, target.mediaId);
  return false;
}
