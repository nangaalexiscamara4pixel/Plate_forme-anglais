import { db } from "@/server/db";
import type { EmailLocale } from "@/server/email/templates";

/** Langue préférée d'un utilisateur pour les emails (français par défaut). */
export async function localeOf(userId: string): Promise<EmailLocale> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { uiLocale: true } });
  return profile?.uiLocale === "en" ? "en" : "fr";
}
