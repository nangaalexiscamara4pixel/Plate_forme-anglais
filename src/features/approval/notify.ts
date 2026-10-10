import { env } from "@/env";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { newRegistration } from "@/server/email/templates";

/**
 * Prévient l'administration qu'une nouvelle demande d'accès attend un examen :
 * notification in-app pour chaque admin + email aux adresses configurées.
 */
export async function notifyAdminsOfRegistration(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true },
  });
  if (!user || user.status !== "PENDING") return;

  const admins = await db.user.findMany({ where: { role: "ADMIN", deletedAt: null }, select: { id: true, email: true } });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "registration.pending",
        payload: { studentId: user.id, name: user.name },
      })),
    });
  }

  const recipients = env.ADMIN_NOTIFICATION_EMAILS.length > 0 ? env.ADMIN_NOTIFICATION_EMAILS : admins.map((a) => a.email);
  await sendEmail(
    recipients,
    newRegistration({ name: user.name, email: user.email, url: `${env.APP_URL}/admin/students/${user.id}` }),
  );
}
