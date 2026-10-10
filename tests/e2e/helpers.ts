import { createHmac } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Browser, type Page } from "@playwright/test";
import { config } from "dotenv";

const MAILBOX = ".dev-mailbox-e2e";
export const ADMIN_SECRET_FILE = ".e2e-admin-totp";
const LAST_STEP_FILE = ".e2e-admin-totp-step";

export const testEnv: Record<string, string> = {};
config({ path: ".env.test", processEnv: testEnv, quiet: true });

type Mail = { to: string[]; subject: string; html: string };

/** Attend le dernier email reçu par `to` dont un lien contient `contains`. */
export async function waitForEmailLink(to: string, contains: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = (await readdir(MAILBOX).catch(() => [] as string[])).sort().reverse();
    for (const f of files) {
      const mail = JSON.parse(await readFile(path.join(MAILBOX, f), "utf8")) as Mail;
      if (!mail.to.includes(to)) continue;
      const link = [...mail.html.matchAll(/href="([^"]+)"/g)]
        .map((m) => m[1]!.replaceAll("&amp;", "&"))
        .find((href) => href.includes(contains));
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Aucun email pour ${to} contenant ${contains}`);
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

/** Code TOTP (RFC 6238 : SHA-1, 30 s, 6 chiffres) — simule l'application d'authentification. */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

/** Code TOTP jamais réutilisé dans la même fenêtre de 30 s (un code ne sert qu'une fois). */
async function freshTotp(secret: string): Promise<string> {
  const lastStep = Number(await readFile(LAST_STEP_FILE, "utf8").catch(() => "-1"));
  let step = Math.floor(Date.now() / 30_000);
  if (step === lastStep) {
    await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 500));
    step = Math.floor(Date.now() / 30_000);
  }
  await writeFile(LAST_STEP_FILE, String(step));
  return totp(secret);
}

/**
 * Connecte l'administrateur du seed dans un nouveau contexte. À la toute première
 * connexion de la suite, active la 2FA et mémorise le secret pour les suivantes.
 */
export async function signInAdmin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Adresse email").fill(testEnv.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Mot de passe").fill(testEnv.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/(setup-2fa|two-factor)$/);

  if (page.url().endsWith("/setup-2fa")) {
    await page.getByLabel("Mot de passe").fill(testEnv.SEED_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Continuer" }).click();
    const secret = (await page.locator("code").first().textContent())!.trim();
    await writeFile(ADMIN_SECRET_FILE, secret);
    await page.locator('input[name="code"]').fill(await freshTotp(secret));
    await page.getByRole("button", { name: "Activer la double authentification" }).click();
  } else {
    const secret = (await readFile(ADMIN_SECRET_FILE, "utf8")).trim();
    await page.locator('input[name="code"]').fill(await freshTotp(secret));
    await page.getByRole("button", { name: "Vérifier" }).click();
  }
  await expect(page).toHaveURL(/\/admin$/);
  return page;
}

/** Inscrit un étudiant par l'interface et confirme son email : il est alors « en attente ». */
export async function registerStudent(browser: Browser, s: { name: string; email: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Nom complet").fill(s.name);
  await page.getByLabel("Numéro WhatsApp").fill("+33 6 12 34 56 78");
  await page.getByLabel("Adresse email").fill(s.email);
  await page.getByLabel("Mot de passe").fill(s.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(page.getByText("Vérifiez votre boîte de réception")).toBeVisible();
  await page.goto(await waitForEmailLink(s.email, "/api/auth/verify-email"));
  await expect(page).toHaveURL(/\/pending$/);
  return page;
}
