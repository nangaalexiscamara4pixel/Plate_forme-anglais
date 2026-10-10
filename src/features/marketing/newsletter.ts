import { createHash, randomBytes } from "node:crypto";
import { env } from "@/env";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { newsletterConfirm } from "@/server/email/templates";

/**
 * Newsletter en double opt-in : l'adresse n'est active qu'après un clic sur le lien de
 * confirmation. Les réponses sont identiques que l'adresse soit connue ou non.
 */
const CONFIRM_TTL_MS = 48 * 3600 * 1000;
const sha256 = (v: string) => createHash("sha256").update(v).digest("base64url");

export async function subscribe(email: string, locale: "fr" | "en") {
  const existing = await db.newsletterSubscriber.findUnique({ where: { email } });
  if (existing?.confirmedAt && !existing.unsubscribedAt) return; // déjà abonné : rien à faire, réponse identique

  const token = randomBytes(32).toString("base64url");
  const data = {
    locale,
    confirmTokenHash: sha256(token),
    confirmTokenExpiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
    consentAt: new Date(),
    unsubscribedAt: null,
    confirmedAt: null,
  };
  const sub = existing
    ? await db.newsletterSubscriber.update({ where: { id: existing.id }, data })
    : await db.newsletterSubscriber.create({ data: { email, unsubscribeToken: randomBytes(24).toString("base64url"), ...data } });

  await sendEmail(
    email,
    newsletterConfirm({
      url: `${env.APP_URL}/newsletter/confirm?token=${token}`,
      unsubscribeUrl: `${env.APP_URL}/newsletter/unsubscribe?token=${sub.unsubscribeToken}`,
      locale,
    }),
  );
}

export async function confirmSubscription(token: string): Promise<boolean> {
  if (!/^[\w-]{20,100}$/.test(token)) return false;
  const sub = await db.newsletterSubscriber.findUnique({ where: { confirmTokenHash: sha256(token) } });
  if (!sub?.confirmTokenExpiresAt || sub.confirmTokenExpiresAt < new Date()) return false;
  await db.newsletterSubscriber.update({
    where: { id: sub.id },
    data: { confirmedAt: new Date(), confirmTokenHash: null, confirmTokenExpiresAt: null, unsubscribedAt: null },
  });
  return true;
}

export async function unsubscribe(token: string): Promise<boolean> {
  if (!/^[\w-]{20,100}$/.test(token)) return false;
  const { count } = await db.newsletterSubscriber.updateMany({
    where: { unsubscribeToken: token },
    data: { unsubscribedAt: new Date(), confirmTokenHash: null, confirmTokenExpiresAt: null },
  });
  return count > 0;
}
