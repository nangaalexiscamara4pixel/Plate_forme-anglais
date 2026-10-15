import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "@/env";
import { logger } from "@/server/logger";
import type { EmailMessage } from "./templates";

export const DEV_MAILBOX_DIR =
  process.env.DEV_MAILBOX_DIR ?? path.join(process.cwd(), process.env.NODE_ENV === "test" ? ".dev-mailbox-test" : ".dev-mailbox");

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** SMTP (ex. Gmail : smtp.gmail.com, port 465, mot de passe d'application) : prioritaire sur Resend. */
const smtp =
  env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST ?? "smtp.gmail.com",
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

/** Avec Gmail, l'expéditeur doit être le compte lui-même : on garde le nom affiché d'EMAIL_FROM. */
function smtpFrom(): string {
  const name = env.EMAIL_FROM.match(/^\s*"?([^"<]+?)"?\s*</)?.[1] ?? "GlobeSpeak Academy";
  return `"${name}" <${env.SMTP_USER}>`;
}

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

  if (smtp) {
    try {
      await smtp.sendMail({ from: smtpFrom(), to: recipients, subject: message.subject, html, text });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err), subject: message.subject }, "échec d'envoi d'email (SMTP)");
    }
    return;
  }

  if (!resend && process.env.NODE_ENV === "production") {
    // Pas de boîte de développement en production (disque en lecture seule) : l'email est perdu.
    logger.error({ subject: message.subject }, "email non envoyé : RESEND_API_KEY manquante");
    return;
  }
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
