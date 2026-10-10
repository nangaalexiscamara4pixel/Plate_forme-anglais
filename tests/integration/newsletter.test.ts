import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { confirmSubscription, subscribe, unsubscribe } from "@/features/marketing/newsletter";
import { visibleTestimonials } from "@/features/marketing/site-config";
import { db } from "@/server/db";
import { DEV_MAILBOX_DIR } from "@/server/email/send";
import { resetDb } from "../support/db";

async function lastLink(email: string, contains: string) {
  const files = (await readdir(DEV_MAILBOX_DIR)).sort().reverse();
  for (const f of files) {
    const mail = JSON.parse(await readFile(path.join(DEV_MAILBOX_DIR, f), "utf8")) as { to: string[]; html: string };
    if (!mail.to.includes(email)) continue;
    const href = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replaceAll("&amp;", "&")).find((h) => h.includes(contains));
    if (href) return new URL(href);
  }
  throw new Error("lien introuvable");
}

describe("newsletter (double opt-in)", () => {
  beforeEach(resetDb);

  it("n'active l'abonnement qu'après confirmation, et stocke le jeton haché", async () => {
    await subscribe("lea@example.test", "fr");
    const pending = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: "lea@example.test" } });
    expect(pending.confirmedAt).toBeNull();

    const link = await lastLink("lea@example.test", "/newsletter/confirm");
    const token = link.searchParams.get("token")!;
    expect(pending.confirmTokenHash).not.toBe(token);

    expect(await confirmSubscription(token)).toBe(true);
    expect(await confirmSubscription(token)).toBe(false); // usage unique
    const active = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: "lea@example.test" } });
    expect(active.confirmedAt).not.toBeNull();
  });

  it("refuse un jeton inconnu ou expiré", async () => {
    await subscribe("tom@example.test", "en");
    const token = (await lastLink("tom@example.test", "/newsletter/confirm")).searchParams.get("token")!;
    await db.newsletterSubscriber.update({ where: { email: "tom@example.test" }, data: { confirmTokenExpiresAt: new Date(Date.now() - 1000) } });
    expect(await confirmSubscription(token)).toBe(false);
    expect(await confirmSubscription("not-a-real-token-but-long-enough")).toBe(false);
  });

  it("désinscription en un clic depuis le lien de l'email", async () => {
    await subscribe("mia@example.test", "fr");
    const link = await lastLink("mia@example.test", "/newsletter/unsubscribe");
    expect(await unsubscribe(link.searchParams.get("token")!)).toBe(true);
    const sub = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: "mia@example.test" } });
    expect(sub.unsubscribedAt).not.toBeNull();
  });

  it("les témoignages d'exemple ne sont jamais affichés en production", () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect(visibleTestimonials().some((t) => t.sample)).toBe(false);
    } finally {
      env.NODE_ENV = previous;
    }
  });
});
