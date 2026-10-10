"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createAction, fail } from "@/server/actions";
import { audit } from "@/server/audit";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { gateFor } from "@/server/dal/access";
import { assertAdmin } from "@/server/dal/guards";
import { getViewer } from "@/server/dal/viewer";

/**
 * « Voir en tant qu'étudiant » : l'administrateur (2FA validée) obtient une session
 * de 30 minutes au nom de l'étudiant, marquée `impersonatedBy`. Cette session est
 * en lecture seule (gardes applicatives + hook Better Auth) et signalée par un bandeau.
 */
export const startImpersonationAction = createAction(z.object({ studentId: z.string().min(1).max(64) }), async ({ studentId }) => {
  const admin = await assertAdmin();
  const student = await db.user.findFirst({
    where: { id: studentId, role: "STUDENT", deletedAt: null },
    select: { id: true, status: true },
  });
  if (!student) return fail("NOT_FOUND");

  await auth.api.impersonateUser({ body: { userId: student.id }, headers: await headers() });
  await audit(
    { actorId: admin.userId, ip: admin.ip, userAgent: admin.userAgent },
    "impersonation.start",
    { type: "user", id: student.id },
  );
  return redirect({ href: student.status === "APPROVED" ? "/app" : gateFor(student.status), locale: await getLocale() });
});

export async function stopImpersonationAction(): Promise<void> {
  const viewer = await getViewer();
  const locale = await getLocale();
  if (!viewer?.impersonatedBy) {
    redirect({ href: "/admin", locale });
    return;
  }
  const adminId = viewer.impersonatedBy;
  await auth.api.stopImpersonating({ headers: await headers() });
  await audit({ actorId: adminId, ip: viewer.ip, userAgent: viewer.userAgent }, "impersonation.stop", {
    type: "user",
    id: viewer.userId,
  });
  redirect({ href: `/admin/students/${viewer.userId}`, locale });
}
