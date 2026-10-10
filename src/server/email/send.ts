import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { env } from "@/env";
import { logger } from "@/server/logger";
import type { EmailMessage } from "./templates";

export const DEV_MAILBOX_DIR =
  process.env.DEV_MAILBOX_DIR ?? path.join(process.cwd(), process.env.NODE_ENV === "test" ? ".dev-mailbox-test" : ".dev-mailbox");

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Envoie un email transactionnel.
 * Sans clé Resend (développement / tests), l'email est écrit dans `.dev-mailbox/`
 * et consultable sur /dev/mailbox. Les erreurs d'envoi sont journalisées sans
 * interrompre le flux appelant (l'utilisateur peut redemander un email).
 */
export async function sendEmail(to: string | string[], message: EmailMessage): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0) return;

  const html = await render(message.react);
  const text = await render(message.react, { plainText: true });

  if (!resend) {
    await mkdir(DEV_MAILBOX_DIR, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeFile(
      path.join(DEV_MAILBOX_DIR, `${id}.json`),
      JSON.stringify({ id, to: recipients, subject: message.subject, html, text, sentAt: new Date().toISOString() }),
    );
    logger.info({ to: recipients.length, subject: message.subject }, "email écrit dans la boîte de dev");
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: recipients,
    subject: message.subject,
    html,
    text,
  });
  if (error) logger.error({ err: error.message, subject: message.subject }, "échec d'envoi d'email");
}
