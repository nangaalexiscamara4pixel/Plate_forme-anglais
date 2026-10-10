"use server";

import { isAPIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { passwordSchema } from "@/features/auth/schemas";
import { MIN_PASSWORD_SCORE, passwordScore } from "@/lib/password-strength";
import { createAction, fail } from "@/server/actions";
import { audit } from "@/server/audit";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getViewer } from "@/server/dal/viewer";

/** Actions sur SON PROPRE compte (administrateur aujourd'hui, étudiants en phase 6). */

async function selfOrThrow() {
  const viewer = await getViewer();
  // Pendant une impersonation, l'admin ne doit pas modifier le compte de l'étudiant.
  if (!viewer || viewer.impersonatedBy) return null;
  return viewer;
}

export const changeOwnPasswordAction = createAction(
  z.object({ currentPassword: z.string().min(1, "required").max(128), newPassword: passwordSchema }),
  async ({ currentPassword, newPassword }) => {
    const viewer = await selfOrThrow();
    if (!viewer) return fail("forbidden");
    if ((await passwordScore(newPassword, [viewer.name, viewer.email])) < MIN_PASSWORD_SCORE) {
      return fail("validation", { newPassword: ["passwordWeak"] });
    }
    try {
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch (err) {
      if (isAPIError(err)) return fail("invalidPassword");
      throw err;
    }
    if (viewer.role === "ADMIN") {
      await audit({ actorId: viewer.userId, ip: viewer.ip, userAgent: viewer.userAgent }, "admin.password.change");
    }
    return { ok: true };
  },
);

/** Déconnecte tous les autres appareils (la session courante est conservée). */
export const revokeOtherOwnSessionsAction = createAction(z.object({}), async () => {
  const viewer = await selfOrThrow();
  if (!viewer) return fail("forbidden");
  await db.session.deleteMany({ where: { userId: viewer.userId, id: { not: viewer.sessionId } } });
  if (viewer.role === "ADMIN") {
    await audit({ actorId: viewer.userId, ip: viewer.ip, userAgent: viewer.userAgent }, "admin.sessions.revoke");
  }
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
});

/** Marque toutes ses notifications comme lues. */
export async function markNotificationsReadAction(): Promise<void> {
  const viewer = await selfOrThrow();
  if (!viewer) return;
  await db.notification.updateMany({ where: { userId: viewer.userId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/[locale]/admin", "layout");
}
