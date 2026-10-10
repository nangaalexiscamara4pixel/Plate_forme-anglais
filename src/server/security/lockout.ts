import { APIError } from "better-auth/api";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { accountLocked } from "@/server/email/templates";
import { localeOf } from "@/server/locale";

/**
 * Verrouillage progressif d'un compte après des échecs de connexion répétés.
 * 5 échecs → 15 min, 10 → 30 min, 15 → 60 min… plafonné à 24 h.
 * Complète la limitation par IP (qui ne protège pas contre une attaque distribuée).
 */
export const LOCKOUT_THRESHOLD = 5;
const BASE_LOCK_MINUTES = 15;
const MAX_LOCK_MINUTES = 60 * 24;

export function lockDurationMinutes(failedCount: number): number {
  if (failedCount < LOCKOUT_THRESHOLD) return 0;
  const tier = Math.floor(failedCount / LOCKOUT_THRESHOLD) - 1;
  return Math.min(BASE_LOCK_MINUTES * 2 ** tier, MAX_LOCK_MINUTES);
}

const normalize = (email: string) => email.trim().toLowerCase();

export async function assertNotLocked(email: string): Promise<void> {
  if (!email) return;
  const user = await db.user.findUnique({ where: { email: normalize(email) }, select: { lockedUntil: true } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    // Même message que la limitation de débit : on ne confirme pas l'existence du compte.
    throw new APIError("TOO_MANY_REQUESTS", { message: "Too many attempts", code: "TOO_MANY_ATTEMPTS" });
  }
}

export async function onSignInFailure(email: string): Promise<void> {
  if (!email) return;
  const user = await db.user.update({
    where: { email: normalize(email) },
    data: { failedLoginCount: { increment: 1 } },
    select: { id: true, name: true, email: true, failedLoginCount: true },
  }).catch(() => null); // email inconnu : rien à faire
  if (!user || user.failedLoginCount % LOCKOUT_THRESHOLD !== 0) return;

  const minutes = lockDurationMinutes(user.failedLoginCount);
  await db.user.update({
    where: { id: user.id },
    data: { lockedUntil: new Date(Date.now() + minutes * 60_000) },
  });
  await sendEmail(user.email, accountLocked({ name: user.name, minutes, locale: await localeOf(user.id) }));
}

export async function onSignInSuccess(email: string): Promise<void> {
  if (!email) return;
  await db.user
    .update({
      where: { email: normalize(email) },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    })
    .catch(() => null);
}
